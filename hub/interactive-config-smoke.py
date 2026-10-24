#!/usr/bin/env python3
"""Actual source setup on a controlling PTY while stdin is a non-terminal."""
import errno,os,pathlib,pty,select,socket,subprocess,tempfile,time,urllib.parse

assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted'
root=pathlib.Path(__file__).resolve().parent.parent
package=root/'dist/connect-hub'
with tempfile.TemporaryDirectory(prefix='hub-interactive-') as raw:
    state=pathlib.Path(raw)
    for name in ('app','data','log','bin'):(state/name).mkdir()
    (state/'app/current').symlink_to(package,target_is_directory=True)
    (state/'data/.connect-hub-owned').touch()
    with socket.socket() as listener:
        listener.bind(('127.0.0.1',0));chosen_port=listener.getsockname()[1]
    env={**os.environ,'CONNECT_HUB_PREFIX':str(state/'app'),'CONNECT_HUB_DATA':str(state/'data'),'CONNECT_HUB_HOST':'127.0.0.1','CONNECT_HUB_TLS_MODE':'off','XUI_DB_FOLDER':str(state/'data'),'XUI_DB_TYPE':'sqlite','XUI_DB_DSN':'','XUI_LOG_FOLDER':str(state/'log'),'XUI_MAIN_FOLDER':str(package),'XUI_BIN_FOLDER':str(state/'bin')}
    env.pop('XUI_NONINTERACTIVE',None)
    prompts=[(b'Choose [1]: ',b'1\n'),(b'[y/n]: ',b'y\n'),(b'Please set up the panel port: ',str(chosen_port).encode()+b'\n'),(b'Choose an option (default 2 for IP): ',b'4\n'),(b'[y/N]: ',b'n\n')]
    pid,master=pty.fork()
    if pid==0:
        # A controlling terminal still exists, but stdin is not a TTY, exactly
        # as when the documented curl pipeline launches the setup child.
        stream=os.open(os.devnull,os.O_RDONLY);os.dup2(stream,0);os.close(stream)
        settings=[key+'='+value for key,value in env.items() if key.startswith(('CONNECT_HUB_','XUI_'))]
        os.execvpe('sudo',['sudo','env',*settings,'bash',str(root/'hub/configure.sh')],env)
    output=bytearray();position=0;deadline=time.monotonic()+90;status=None
    try:
        while time.monotonic()<deadline:
            ready,_,_=select.select([master],[],[],.25)
            if ready:
                try:part=os.read(master,65536)
                except OSError as error:
                    if error.errno==errno.EIO:break
                    raise
                if not part:break
                output.extend(part)
                if position<len(prompts) and prompts[position][0] in output:
                    os.write(master,prompts[position][1]);position+=1
            finished,code=os.waitpid(pid,os.WNOHANG)
            if finished:status=code;break
        else:raise AssertionError('Interactive source setup timed out at prompt '+str(position))
        if status is None:_,status=os.waitpid(pid,0)
        assert os.waitstatus_to_exitcode(status)==0,'Interactive setup failed at prompt '+str(position)
        assert position==len(prompts),'Expected original setup prompts were skipped: '+str(position)
        access=subprocess.check_output(['sudo','cat',str(state/'data/initial-access.txt')],text=True)
        credentials=dict(line.split('=',1) for line in access.splitlines())
        assert urllib.parse.urlparse(credentials['URL']).port==chosen_port
        assert (state/'data/connect-hub.db').is_file()
        assert b'Database Selection' in output and b'Panel Installation Complete!' in output
        print('PASS: piped stdin uses the controlling terminal for original DB, custom port and SSL choices; the entered port is stored in the real initialized database')
    finally:
        os.close(master)
        if status is None:
            try:os.kill(pid,15);os.waitpid(pid,0)
            except ProcessLookupError:pass
        # Only disposable files within this verified temporary directory.
        assert state.resolve().name.startswith('hub-interactive-')
        subprocess.run(['sudo','chown','-hR',str(os.getuid())+':'+str(os.getgid()),str(state)],check=True)
