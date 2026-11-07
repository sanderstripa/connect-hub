#!/usr/bin/env python3
"""Integrate only changes made by upstream feature PRs to locale dictionaries."""
import concurrent.futures
import copy
import json
import os
from pathlib import Path
import urllib.request

ROOT=Path(__file__).resolve().parent.parent
LANGS=("ar-EG","en-US","es-ES","fa-IR","id-ID","ja-JP","pt-BR","ru-RU","sk-SK","tr-TR","uk-UA","vi-VN","zh-CN","zh-TW")
PRS=(7064,7031,7048,6970,6972,7086,6958,7088,6952,7012,7006)
MISSING=object()
HEADERS={"User-Agent":"Connect-Hub-upstream-localization/1.0","Accept":"application/vnd.github+json"}
token=os.getenv("GITHUB_TOKEN","")
if token: HEADERS["Authorization"]="Bearer "+token

def fetch(url):
    req=urllib.request.Request(url,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=28) as response:
        return response.read()

def loadpair(number,base,head,locale):
    name=f"internal/web/translation/{locale}.json"
    urls=[f"https://raw.githubusercontent.com/MHSanaei/3x-ui/{sha}/{name}" for sha in (base,head)]
    try:
        return number,locale,json.loads(fetch(urls[0])),json.loads(fetch(urls[1]))
    except Exception as e:
        print(f"cannot retrieve upstream #{number} {locale}: {type(e).__name__} {e}")
        return number,locale,None,None

def overlay(base,head,target,path="",stats=None):
    if not isinstance(base,dict) or not isinstance(head,dict) or not isinstance(target,dict):
        return
    for key,value in head.items():
        prefix=f"{path}.{key}" if path else key
        was=base.get(key,MISSING)
        now=target.get(key,MISSING)
        if isinstance(value,dict) and isinstance(was,dict) and isinstance(now,dict):
            overlay(was,value,now,prefix,stats)
        elif was is MISSING and now is MISSING:
            target[key]=copy.deepcopy(value)
            stats["add"]+=1
        elif was is not MISSING and was!=value and now==was:
            target[key]=copy.deepcopy(value)
            stats["update"]+=1
        elif was is not MISSING and was!=value and now!=value and now!=was:
            stats["conflicts"].add(prefix)

def main():
    locale_dir=ROOT/"internal/web/translation"
    originals={lang:json.loads((locale_dir/f"{lang}.json").read_text()) for lang in LANGS}
    current=copy.deepcopy(originals)
    for n in PRS:
        try:
            meta=json.loads(fetch(f"https://api.github.com/repos/MHSanaei/3x-ui/pulls/{n}"))
            base,head=meta["base"]["sha"],meta["head"]["sha"]
        except Exception as e:
            raise SystemExit(f"cannot get upstream #{n} metadata: {e}")
        jobs=[(n,base,head,lang) for lang in LANGS]
        stats={"add":0,"update":0,"conflicts":set()}
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            pairs=list(pool.map(lambda job:loadpair(*job),jobs))
        for _,lang,base_json,head_json in pairs:
            if base_json is None or head_json is None:
                raise SystemExit(f"incomplete locale sources for upstream #{n} ({lang})")
            overlay(base_json,head_json,current[lang],stats=stats)
        print(f"upstream #{n}: added={stats['add']} updated={stats['update']} conflicts={len(stats['conflicts'])}")
        if stats["conflicts"]:
            print("  nonmatching values (preserved local): "+", ".join(sorted(stats["conflicts"])[:20]))
    for lang in LANGS:
        current[lang].setdefault("menu",{})["assistant"]= "ИИ-помощник" if lang=="ru-RU" else "AI Assistant"
        output=json.dumps(current[lang],ensure_ascii=False,indent=2)+"\n"
        if output!=(locale_dir/f"{lang}.json").read_text():
            (locale_dir/f"{lang}.json").write_text(output)
    print("Merged locale keys for all 14 languages.")

if __name__=="__main__":main()
