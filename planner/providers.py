"""Public Banner search adapter, with bounded traffic and no enrollment actions."""
import http.cookiejar
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from email.utils import parsedate_to_datetime
from datetime import date, timedelta
from .models import normalize
from .course_details import parse_detail

BASE = 'https://reg-prod.ec.ucmerced.edu/StudentRegistrationSsb'

class ProviderError(Exception):
    def __init__(self, message, retry_after=60):
        super().__init__(message)
        self.retry_after = retry_after

class OfficialProvider:
    name = 'live'
    def __init__(self):
        self.lock = threading.Lock()
        self.last_request = 0
        self.blocked_until = 0

    def session(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())), str(uuid.uuid4())

    def request(self, session, path, params=None, post=False, json_response=True):
        opener, sid = session
        params = dict(params or {}, uniqueSessionId=sid)
        encoded = urllib.parse.urlencode(params)
        url = BASE + path
        if not post:
            url += ('&' if '?' in url else '?') + encoded
        req = urllib.request.Request(url, data=encoded.encode() if post else None,
            headers={'User-Agent': 'UCM-Local-Course-Planner/1.0', 'Accept': 'application/json' if json_response else 'text/html'})
        with self.lock:
            if time.monotonic() < self.blocked_until:
                raise ProviderError('University request cooldown is active. Please wait.', int(self.blocked_until-time.monotonic())+1)
            time.sleep(max(0, 0.8 - (time.monotonic() - self.last_request)))
            try:
                with opener.open(req, timeout=20) as response:
                    if urllib.parse.urlparse(response.url).hostname != urllib.parse.urlparse(BASE).hostname:
                        raise ProviderError('The university redirected to sign-in. Public data is unavailable; no login was attempted.', 600)
                    raw = response.read(12_000_001)
                    if len(raw) > 12_000_000:
                        raise ProviderError('University response exceeds the safety limit.')
                return json.loads(raw) if json_response else raw
            except urllib.error.HTTPError as exc:
                delay = 600 if exc.code in (401, 403, 429) else 60
                retry = exc.headers.get('Retry-After', '')
                if retry.isdigit():
                    delay = max(delay, int(retry))
                elif retry:
                    try:
                        delay = max(delay, int(parsedate_to_datetime(retry).timestamp()-time.time())+1)
                    except (ValueError, TypeError, OverflowError):
                        pass
                self.blocked_until = time.monotonic() + delay
                raise ProviderError(f'University returned HTTP {exc.code}. Your saved plans are safe.', delay) from exc
            except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
                raise ProviderError('Cannot read public university data right now. Check your connection or try again later.') from exc
            finally:
                self.last_request = time.monotonic()

    def terms(self):
        rows = self.request(self.session(), '/ssb/courseSearch/getTerms', {'searchTerm':'', 'offset':1, 'max':10})
        if not isinstance(rows, list):
            raise ProviderError('The university term response format changed.')
        return [{'id':str(r['code']), 'name':r['description']} for r in rows]

    def courses(self, term):
        session = self.session()
        self.request(session, '/ssb/term/termSelection', {'mode':'courseSearch'}, json_response=False)
        selected = self.request(session, '/ssb/term/search?mode=courseSearch',
            {'term':term, 'studyPath':'', 'studyPathText':'', 'startDatepicker':'', 'endDatepicker':''}, post=True)
        if selected.get('studentEligFailures'):
            raise ProviderError('; '.join(selected['studentEligFailures']), 600)
        result, seen, offset = [], set(), 0
        for _ in range(60):
            page = self.request(session, '/ssb/searchResults/searchResults',
                {'txt_term':term, 'pageOffset':offset, 'pageMaxSize':100,
                 'sortColumn':'subjectDescription', 'sortDirection':'asc'})
            if page.get('success') is not True or not isinstance(page.get('data'), list):
                raise ProviderError('University search failed or its response format changed.')
            rows = page['data']
            for row in rows:
                if str(row.get('term')) != term:
                    raise ProviderError('University returned a different semester. Results were rejected.')
                key = str(row['courseReferenceNumber'])
                if key in seen:
                    raise ProviderError('University pagination repeated a section. Incomplete snapshot rejected.')
                seen.add(key)
                result.append(normalize(row))
            offset += len(rows)
            if offset >= int(page.get('totalCount', 0)):
                return result
            if not rows:
                break
        raise ProviderError('University search was incomplete. The previous snapshot is retained.')

    def linked(self, term, crn):
        """Each public linkedData entry is one complete companion combination.

        The originating section is implicit, as in Banner's linked-section UI.
        An empty response for a flagged section means unknown, not complete.
        """
        response = self.request(self.session(), '/ssb/searchResults/fetchLinkedSections',
            {'term':term, 'courseReferenceNumber':crn})
        if not isinstance(response, dict) or not isinstance(response.get('linkedData'), list):
            raise ProviderError('University linked-section response format changed.')
        combinations = []
        for rows in response['linkedData']:
            if not isinstance(rows, list) or not rows:
                raise ProviderError('University returned an incomplete linked-section combination.')
            combination = []
            for row in rows:
                if not isinstance(row, dict) or str(row.get('term')) != term or not row.get('courseReferenceNumber'):
                    raise ProviderError('University returned invalid linked sections or a different semester.')
                if str(row['courseReferenceNumber']) == crn:
                    continue
                section = normalize(row)
                section.pop('availability')  # Requirement cache is not an enrollment snapshot.
                combination.append(section)
            if not combination:
                raise ProviderError('University returned no companion sections in a linked combination.')
            combinations.append(combination)
        return combinations

    def details(self, term, crn):
        session=self.session()
        result=[]
        for label, endpoint, section in [
            ('Course description','getCourseDescription','courseDescription'),
            ('Prerequisites','getSectionPrerequisites','preReqs'),
            ('Corequisites','getCorequisites','coReqs'),
            ('Enrollment restrictions','getRestrictions','restrictions')]:
            path='/ssb/searchResults/'+endpoint
            params={'term':term,'courseReferenceNumber':crn}
            raw=self.request(session,path,params,json_response=False)
            result.append(dict(label=label,sourceUrl=BASE+path+'?'+urllib.parse.urlencode(params),
                               **parse_detail(raw,section)))
        return result

class DemoProvider:
    """Synthetic fixtures only; never presented as university data."""
    name = 'demo'
    def terms(self):
        return [{'id':'demo', 'name':'Demo semester · synthetic data'}]

    def linked(self, term, crn):
        rows = {c['id']:c for c in self.courses(term)}
        combinations = {'DEMO-1':[['DEMO-3']], 'DEMO-6':[['DEMO-3']],
                        'DEMO-3':[['DEMO-1'],['DEMO-6']]}.get(crn, [])
        return [[{k:v for k,v in rows[key].items() if k != 'availability'} for key in group] for group in combinations]

    def details(self, term, crn):
        if term!='demo' or crn not in {c['id'] for c in self.courses(term)}:
            raise ProviderError('Unknown demo section.')
        return [dict(label=label,text=text,tables=[],sourceUrl=None) for label,text in [
            ('Course description','Synthetic demonstration course. This is not an official UC Merced course description.'),
            ('Prerequisites','Demo only: no real prerequisite rules are represented.'),
            ('Corequisites','Demo only: see the synthetic linked-section combinations.'),
            ('Enrollment restrictions','Demo only: this section cannot be registered for.')]]

    def courses(self, term):
        if term != 'demo':
            raise ProviderError('Unknown demo term.')
        start = date.today() - timedelta(days=date.today().weekday())
        rows = []
        for i, (title, days, begin, end, seats) in enumerate([
            ('Example Computing Lecture', [0,2,4], 600,650,12),
            ('Example Mathematics Lecture', [0,2],630,705,2),
            ('Example Computing Lab', [1],840,950,0),
            ('Example Writing Seminar', [1,3],660,735,8),
            ('Example Independent Study', [],None,None,None),
            ('Example Computing Lecture', [1,3],780,855,20)]):
            rows.append(dict(id=f'DEMO-{i+1}', term=term, subject='DEMO', number='101' if i in (0,2,5) else str(102+i),
                title=title, section=str(i+1), kind='Lab' if i==2 else 'Lecture', instructors=['Example Instructor'],
                units=0 if i==2 else 4, unitsMin=0, unitsMax=4, linked=i in (0,2,5), linkIdentifier=None,
                meetings=[dict(days=days,start=begin,end=end,startDate=start.isoformat(),endDate=(start+timedelta(days=100)).isoformat(),location='Example room',type='Class')],
                availability=dict(capacity=30,enrolled=30-seats if seats is not None else None,seats=seats,waitCapacity=5 if i==2 else 0,waitCount=2 if i==2 else 0,waitAvailable=3 if i==2 else 0,crossListAvailable=None)))
        return rows
