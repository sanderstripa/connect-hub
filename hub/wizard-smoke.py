#!/usr/bin/env python3
"""Real terminal wizard: RU, hardware, decline BBR/swap, choose IP. No host changes."""
import errno,hashlib,json,os,pathlib,pty,select,subprocess,tempfile,time
assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted'
root=pathlib.Path(__file__).resolve().parent.parent
protected=[pathlib.Path('/etc/fstab'),pathlib.Path('/proc/swaps'),pathlib.Path('/etc/sysctl.d/90-connect-hub-bbr.conf')]
def snapshot():
    result=[]
    for p in protected:
        if str(p)=='/proc/swaps':result.append([row.split()[:3]+row.split()[4:] for row in p.read_text().splitlines()[1:]])
        else:result.append(hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None)
    return result
before=snapshot()
with tempfile.TemporaryDirectory(prefix='hub-wizard-') as raw:
    state=pathlib.Path(raw);data=state/'data';data.mkdir();(data/'.connect-hub-owned').touch()
    pid,master=pty.fork()
    if pid==0:
        env={**os.environ,'CONNECT_HUB_HOST':'127.0.0.1'}
        for key in ['CONNECT_HUB_NONINTERACTIVE','CONNECT_HUB_LANGUAGE','CONNECT_HUB_INTRO_SHOWN','CONNECT_HUB_DOMAIN']:env.pop(key,None)
        os.execvpe('sudo',['sudo','env','-u','CONNECT_HUB_LANGUAGE','-u','CONNECT_HUB_NONINTERACTIVE','-u','CONNECT_HUB_DOMAIN','-u','CONNECT_HUB_INTRO_SHOWN','CONNECT_HUB_HOST=127.0.0.1','python3','-B',str(root/'hub/setup-wizard.py'),'--prefix',str(state/'app'),'--data',str(data)],env)
    answers=[('English [1]:','1\n'),('Включить BBR?','n\n'),('swap-файл:','0\n'),('Адрес панели:','1\n')]
    output='';answered=set();status=None;deadline=time.monotonic()+45
    try:
        while time.monotonic()<deadline:
            ready,_,_=select.select([master],[],[],.2)
            if ready:
                try:part=os.read(master,65536)
                except OSError as error:
                    if error.errno==errno.EIO:break
                    raise
                if not part:break
                output+=part.decode('utf-8',errors='replace')
                for index,(prompt,answer) in enumerate(answers):
                    if index not in answered and prompt in output:os.write(master,answer.encode());answered.add(index)
            finished,code=os.waitpid(pid,os.WNOHANG)
            if finished:status=code;break
        else:raise AssertionError('Wizard did not finish; answered prompts: '+str(answered))
        if status is None:_,status=os.waitpid(pid,0)
        assert os.waitstatus_to_exitcode(status)==0,output[-2000:]
        assert {0,2,3}<=answered,output[-2000:]
        saved=json.loads(subprocess.check_output(['sudo','cat',str(data/'setup.json')],text=True))
        assert saved['language']=='ru' and saved['addressMode']=='ip' and saved['host']=='127.0.0.1'
        assert saved['hardware']['cpus']>=1 and saved['hardware']['ramGB']>0
        assert 'CPU' in output and 'GB RAM' in output and 'GB disk' in output
        assert snapshot()==before,'Declined options must not change swap, fstab or BBR configuration'
        print('PASS: real RU terminal wizard, detected hardware, IP address and declined BBR/swap; host settings unchanged')
    finally:
        os.close(master)
        if status is None:
            try:os.kill(pid,15);os.waitpid(pid,0)
            except ProcessLookupError:pass
        assert state.resolve().name.startswith('hub-wizard-')
        subprocess.run(['sudo','chown','-hR',str(os.getuid())+':'+str(os.getgid()),str(state)],check=True)
