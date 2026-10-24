"""Native Sudoku regression checks against the real panel and compatible client."""
import json,pathlib,sqlite3,subprocess,time

def run(request,csrf,core,td,passed,result):
    a,b,laptop,laptop_cfg,tablet_cfg,phone_cfg,check=result
    generated=subprocess.run([str(core),'-keygen','-more',phone_cfg['key']],capture_output=True,text=True,check=True)
    split=next(line.split('Split Private Key:',1)[1].strip() for line in (generated.stdout+'\n'+generated.stderr).splitlines() if 'Split Private Key:' in line)
    check({**phone_cfg,'key':split},False)
    check(laptop_cfg);check(tablet_cfg)
    passed('an unregistered key derived from a revoked key cannot bypass native client access control')
    def api(path,payload=None):
        response=request(path,payload,csrf,json_body=payload is not None)
        assert response['success'],response.get('msg')
        return response.get('obj')
    rows=api('panel/api/inbounds/list');native=[row for row in rows if row['protocol']=='sudoku']
    assert len(native)==2 and all(row['id']>0 for row in native)
    office=next(row for row in native if row['remark']=='Office')
    settings=office['settings'];settings=json.loads(settings) if isinstance(settings,str) else settings
    client=next(c for c in settings['clients'] if c['sudokuKey']==laptop_cfg['key'])
    links=api('panel/api/clients/links/'+client['email'])
    assert 'sudoku://' in json.dumps(links),'ordinary client links omit Sudoku'
    update={'id':office['id'],'remark':'Office','protocol':'sudoku','port':office['port'],'listen':'127.0.0.1','settings':json.dumps(settings),'streamSettings':'','sniffing':'','shareAddrStrategy':'custom','shareAddr':'127.0.0.1','trafficReset':'never','trafficResetDay':1,'subSortIndex':1}
    api('panel/api/inbounds/update/'+str(office['id']),update)
    listeners=subprocess.check_output(['ss','-H','-ltn'],text=True)
    assert any(line.split()[3]==f"127.0.0.1:{office['port']}" for line in listeners.splitlines()),'standard listen field was ignored'
    check(laptop_cfg)
    passed('standard positive-ID inbound list, client links, inbound edit and listen-address binding work for Sudoku')
    for _ in range(40):
        rows=api('panel/api/inbounds/list');office=next(row for row in rows if row['id']==office['id'])
        if int(office['up'])+int(office['down'])>0:break
        time.sleep(.25)
    else:raise AssertionError('real Sudoku traffic is absent from ordinary inbound accounting')
    passed('real Sudoku traffic appears in the ordinary panel counters')
    backup=request('panel/api/server/getDb',raw=True);assert backup.startswith(b'SQLite format 3')
    path=pathlib.Path(td)/'native-sudoku-backup.db';path.write_bytes(backup)
    with sqlite3.connect(path) as db:
        saved=[json.loads(row[0]) for row in db.execute("select settings from inbounds where protocol='sudoku'")]
    assert len(saved)==2 and any(c['sudokuKey']==laptop_cfg['key'] for s in saved for c in s['clients'])
    assert all(s['masterKey'] and s['publicKey'] for s in saved)
    passed('ordinary database backup includes every native Sudoku server identity and device key')
