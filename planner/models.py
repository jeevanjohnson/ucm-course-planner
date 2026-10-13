"""Translate the university response into the provider-neutral UI contract."""
from datetime import datetime
from html import unescape

DAYS = ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')

def date(value):
    if not value:
        return None
    return datetime.strptime(value, '%m/%d/%Y').date().isoformat()

def minute(value):
    if not value:
        return None
    value = str(value).zfill(4)
    hour, minutes = int(value[:2]), int(value[2:])
    if hour > 23 or minutes > 59:
        return None
    return hour * 60 + minutes

def normalize(row):
    units = row.get('creditHours')
    if units is None and row.get('creditHourHigh') is None:
        units = row.get('creditHourLow')
    meetings = []
    instructors = {unescape(f.get('displayName', '')) for f in row.get('faculty', [])}
    for item in row.get('meetingsFaculty', []):
        instructors.update(unescape(f.get('displayName', '')) for f in item.get('faculty', []))
        m = item.get('meetingTime') or {}
        meetings.append(dict(days=[i for i, d in enumerate(DAYS) if m.get(d)],
            start=minute(m.get('beginTime')), end=minute(m.get('endTime')),
            startDate=date(m.get('startDate')), endDate=date(m.get('endDate')),
            location=unescape(' '.join(str(x) for x in [m.get('buildingDescription'), m.get('room')] if x)) or 'Location TBA',
            type=m.get('meetingTypeDescription') or row.get('scheduleTypeDescription') or 'Meeting'))
    return dict(id=str(row['courseReferenceNumber']), term=str(row['term']),
        subject=row.get('subject', ''), number=row.get('courseNumber', ''),
        title=unescape(row.get('courseTitle', '')), section=row.get('sequenceNumber', ''),
        kind=row.get('scheduleTypeDescription', ''),
        instructors=sorted(instructors - {''}), meetings=meetings,
        units=units, unitsMin=row.get('creditHourLow'), unitsMax=row.get('creditHourHigh'),
        linked=bool(row.get('isSectionLinked')), linkIdentifier=row.get('linkIdentifier'),
        availability=dict(capacity=row.get('maximumEnrollment'), enrolled=row.get('enrollment'),
            seats=row.get('seatsAvailable'), waitCapacity=row.get('waitCapacity'),
            waitCount=row.get('waitCount'), waitAvailable=row.get('waitAvailable'),
            crossListAvailable=row.get('crossListAvailable')))
