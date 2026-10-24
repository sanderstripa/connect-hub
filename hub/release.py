#!/usr/bin/env python3
"""Resolve an installable Connect Hub GitHub release; never execute remote scripts."""
import json,re,sys,urllib.error,urllib.request

API='https://api.github.com/repos/sanderstripa/connect-hub/releases'
TAG=re.compile(r'v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?')

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Connect-Hub-updater','Accept':'application/vnd.github+json'}),timeout=30) as response:
        return json.load(response)

def installable(release,arch):
    tag=release.get('tag_name','')
    names={asset.get('name') for asset in release.get('assets',[])}
    return not release.get('draft') and bool(TAG.fullmatch(tag)) and {'SHA256SUMS',f'connect-hub-linux-{arch}.tar.gz'}<=names

def resolve(arch='amd64',tag='',fetch=get):
    if tag:
        if not TAG.fullmatch(tag) and tag!='dev-latest':raise ValueError('Invalid Connect Hub release tag')
        release=fetch(API+'/tags/'+tag)
        if tag=='dev-latest':
            if release.get('draft') or not {'SHA256SUMS',f'connect-hub-linux-{arch}.tar.gz'}<={a.get('name') for a in release.get('assets',[])}:raise ValueError('No installable Connect Hub development release')
        elif not installable(release,arch):raise ValueError('Release has no verified package for this architecture')
        return release['tag_name']
    try:
        stable=fetch(API+'/latest')
    except urllib.error.HTTPError as error:
        if error.code!=404:raise
    else:
        if installable(stable,arch):return stable['tag_name']
    # GitHub /latest excludes prereleases. During alpha, choose the newest
    # published installable prerelease, skipping drafts and partial uploads.
    for release in fetch(API+'?per_page=100'):
        if installable(release,arch):return release['tag_name']
    raise ValueError('No installable Connect Hub release is published')

if __name__=='__main__':
    try:print(resolve(sys.argv[1] if len(sys.argv)>1 else 'amd64',sys.argv[2] if len(sys.argv)>2 else ''))
    except Exception as error:raise SystemExit(f'Connect Hub release lookup failed: {error}')
