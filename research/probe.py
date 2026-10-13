"""Read-only investigation using the public search UI's requests."""
import json, urllib.request, urllib.parse, http.cookiejar, uuid, pathlib
BASE='https://reg-prod.ec.ucmerced.edu/StudentRegistrationSsb'
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
sid=str(uuid.uuid4())
def call(path, params=None, post=False):
    params=dict(params or {}, uniqueSessionId=sid)
    encoded=urllib.parse.urlencode(params)
    req=urllib.request.Request(BASE+path+('' if post else '?'+encoded), data=encoded.encode() if post else None)
    with opener.open(req,timeout=25) as r: return r.read().decode()
call('/ssb/term/termSelection',{'mode':'courseSearch'})
terms=json.loads(call('/ssb/courseSearch/getTerms',{'offset':1,'max':10}))
term=terms[1]['code']
print('Selected',term)
print(call('/ssb/term/search?mode=courseSearch', {'term':term,'studyPath':'','studyPathText':'','startDatepicker':'','endDatepicker':''},True))
data=json.loads(call('/ssb/searchResults/searchResults',{'txt_term':term,'pageOffset':0,'pageMaxSize':10,'sortColumn':'subjectDescription','sortDirection':'asc'}))
pathlib.Path('research/verified-sample.json').write_text(json.dumps(data,indent=2))
print('success',data.get('success'),'count',data.get('totalCount'),'terms',set(x['term'] for x in data.get('data',[])))
