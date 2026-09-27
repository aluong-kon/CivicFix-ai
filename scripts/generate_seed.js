import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const categories = [
  { name: 'Electrical & Power Hazard', severityRange: [9, 10], baseConf: 0.94 },
  { name: 'Water & Drainage Emergency', severityRange: [8, 10], baseConf: 0.91 },
  { name: 'Traffic Safety & Signals', severityRange: [8, 9], baseConf: 0.88 },
  { name: 'Roads & Severe Potholes', severityRange: [6, 9], baseConf: 0.89 },
  { name: 'Obstructions & Fallen Trees', severityRange: [6, 8], baseConf: 0.85 },
  { name: 'Pedestrian Infrastructure', severityRange: [4, 7], baseConf: 0.76 },
  { name: 'Street Lighting Outage', severityRange: [3, 6], baseConf: 0.82 },
  { name: 'Sanitation & Illegal Dumping', severityRange: [2, 5], baseConf: 0.79 },
  { name: 'Public Park / Amenity Damage', severityRange: [2, 4], baseConf: 0.55 }, // some < 0.6 for review flag!
  { name: 'Vandalism & Graffiti', severityRange: [1, 3], baseConf: 0.52 }, // some < 0.6
];

const locations = [
  '5th Ave & Market St, Downtown',
  'Oak St & 12th Ave, Midtown',
  'Broadway & Grand Ave, Central Square',
  'Elm Rd & 8th St, North Park',
  'Pine Valley Blvd & 4th Ave, Westside',
  'MLK Jr Way & University Dr, Campus',
  'Cedar Lane & Riverwalk Path, East Bank',
  'Washington St & Harbor Blvd, Port District',
  'Jefferson Ave & 21st St, Industrial Park',
  'Maple Court & Hilltop Rd, Highland Heights',
  'Sunset Blvd & Vista Way, Scenic Ridge',
  'Lakeview Terrace & Shore Dr, Bayfront',
  'Willow Creek Dr & Aspen Way, Suburbia',
  'Chestnut St & Industrial Way, Southgate',
  'Harrison St & 3rd Ave, Arts District',
  'Cypress Point & Marina Blvd, Wharf',
  'Adams Ave & Lincoln Park Way, Eastside',
  'Roosevelt Way & 15th Ave, Northside',
  'Taylor St & Columbus Ave, North Beach',
  'Mission St & 16th St, Mission District'
];

const reporterNames = [
  'Marcus Vance', 'Elena Rostova', 'David Chen', 'Sarah Jenkins', 'Carlos Mendez',
  'Amara Okafor', 'Brian O\'Connor', 'Priya Patel', 'James Wilson', 'Fatima Al-Mansoor',
  'Liam Gallagher', 'Sofia Rodriguez', 'Kenji Sato', 'Rachel Green', 'Jamal Washington',
  'Chloe Martin', 'Alexander Schmidt', 'Maya Lin', 'Lucas Silva', 'Aisha Khan'
];

const issuesTemplates = [
  {
    catIndex: 0,
    transcript: 'Live electrical cable snapped and dangling right above pedestrian crosswalk! Sparks shooting when wind blows.',
    desc: 'Sparks observed on sidewalk near pole. High risk of electrocution.',
    severity: 10,
    conf: 0.96
  },
  {
    catIndex: 1,
    transcript: 'Water main burst violently, water gushing 4 feet into the air and flooding both traffic lanes.',
    desc: 'Road surface is buckling under water pressure. Cars are being diverted.',
    severity: 10,
    conf: 0.94
  },
  {
    catIndex: 2,
    transcript: 'Traffic signal blackout at this four-way blind intersection. Already witnessed two near-miss collisions.',
    desc: 'Signal completely dark, no flashing red backup. Emergency traffic control needed.',
    severity: 9,
    conf: 0.92
  },
  {
    catIndex: 3,
    transcript: 'Deep crater-sized pothole spanning half the lane, roughly 8 inches deep. Two cars already blown tires.',
    desc: 'Severely damaged pavement rim, exposed rebar underneath.',
    severity: 8,
    conf: 0.88
  },
  {
    catIndex: 4,
    transcript: 'Huge mature oak branch fell across road after heavy wind, completely blocking traffic direction.',
    desc: 'Tree limb is about 2 feet thick, resting on power lines as well.',
    severity: 7,
    conf: 0.86
  },
  {
    catIndex: 5,
    transcript: 'Wheelchair access curb ramp completely cracked and broken off, leaving a 6 inch drop.',
    desc: 'Elderly pedestrian tripped yesterday. Non-compliant with ADA safety.',
    severity: 6,
    conf: 0.78
  },
  {
    catIndex: 6,
    transcript: 'Three consecutive streetlights out along this dark pedestrian alleyway. Very unsafe at night.',
    desc: 'Bulbs or wiring knocked out. Heavy pedestrian foot traffic.',
    severity: 5,
    conf: 0.83
  },
  {
    catIndex: 7,
    transcript: 'Truck dumped multiple large chemical drums and construction debris into drainage culvert.',
    desc: 'Pungent chemical odor, barrels leaking slightly into storm channel.',
    severity: 5,
    conf: 0.75
  },
  {
    catIndex: 8,
    transcript: 'Kids park slide has cracked fiberglass and sharp jagged plastic edges near top ladder.',
    desc: 'Hazard for children playing at neighborhood park.',
    severity: 3,
    conf: 0.54 // below 0.6 -> Flagged for human review!
  },
  {
    catIndex: 9,
    transcript: 'Graffiti tagging on back side of park bench and public recycling bin.',
    desc: 'Aesthetic issue, no structural damage.',
    severity: 2,
    conf: 0.48 // below 0.6 -> Flagged for human review!
  }
];

const samplePhotos = [
  'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f7?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1520690214124-2405c5217036?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1590496793929-36417d3117de?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508873696983-2df5293cb325?w=800&auto=format&fit=crop&q=80'
];

const reports = [];

// Seed 247 reports
// We will create parent reports and deliberate duplicate clusters
// Cluster 1: 5th Ave & Market St Sinkhole (1 primary + 7 duplicates = 8 reports)
// Cluster 2: Oak St Water Main (1 primary + 5 duplicates = 6 reports)
// Cluster 3: Elm Rd Live Wire (1 primary + 4 duplicates = 5 reports)
// Cluster 4: Broadway Signal Out (1 primary + 3 duplicates = 4 reports)
// Cluster 5: Pine Valley Pothole (1 primary + 3 duplicates = 4 reports)
// Cluster 6: Cedar Lane Tree Fall (1 primary + 2 duplicates = 3 reports)
// Plus regular reports and a few small pairs

const primaryIds = {};

for (let i = 1; i <= 247; i++) {
  const codeNum = String(i).padStart(4, '0');
  const tracking_code = `CFX-2026-${codeNum}`;
  const id = crypto.randomUUID();

  let isDuplicate = false;
  let duplicate_of = null;
  let templateIndex = (i - 1) % issuesTemplates.length;
  let loc = locations[i % locations.length];
  let repName = reporterNames[i % reporterNames.length];
  let repPhone = `555-${String(100 + (i % 900))}-${String(1000 + (i * 37) % 9000)}`;

  // Planned duplicates
  if (i === 1) {
    primaryIds['sinkhole'] = id;
    loc = '5th Ave & Market St, Downtown';
    templateIndex = 3; // Pothole/sinkhole
  } else if (i >= 2 && i <= 8) {
    // Duplicates of sinkhole
    isDuplicate = true;
    duplicate_of = primaryIds['sinkhole'];
    loc = '5th Ave & Market St, Downtown';
    templateIndex = 3;
  } else if (i === 9) {
    primaryIds['watermain'] = id;
    loc = 'Oak St & 12th Ave, Midtown';
    templateIndex = 1; // Water main burst
  } else if (i >= 10 && i <= 14) {
    // Duplicates of water main
    isDuplicate = true;
    duplicate_of = primaryIds['watermain'];
    loc = 'Oak St & 12th Ave, Midtown';
    templateIndex = 1;
  } else if (i === 15) {
    primaryIds['livewire'] = id;
    loc = 'Elm Rd & 8th St, North Park';
    templateIndex = 0; // Live wire
  } else if (i >= 16 && i <= 19) {
    isDuplicate = true;
    duplicate_of = primaryIds['livewire'];
    loc = 'Elm Rd & 8th St, North Park';
    templateIndex = 0;
  } else if (i === 20) {
    primaryIds['trafficsignal'] = id;
    loc = 'Broadway & Grand Ave, Central Square';
    templateIndex = 2; // Traffic signal
  } else if (i >= 21 && i <= 23) {
    isDuplicate = true;
    duplicate_of = primaryIds['trafficsignal'];
    loc = 'Broadway & Grand Ave, Central Square';
    templateIndex = 2;
  } else if (i === 50) {
    primaryIds['pinepothole'] = id;
    loc = 'Pine Valley Blvd & 4th Ave, Westside';
    templateIndex = 3;
  } else if (i === 51 || i === 52) {
    isDuplicate = true;
    duplicate_of = primaryIds['pinepothole'];
    loc = 'Pine Valley Blvd & 4th Ave, Westside';
    templateIndex = 3;
  }

  const tpl = issuesTemplates[templateIndex];
  const cat = categories[tpl.catIndex];

  // Variations in transcript for duplicates to mimic real citizens reporting the same event
  let transcript = tpl.transcript;
  let text_description = tpl.desc;
  if (isDuplicate) {
    transcript = `Calling again regarding the issue at ${loc}. ${tpl.transcript.slice(0, 45)}... Citizen report follow-up.`;
    text_description = `Duplicate report notification. ${tpl.desc}`;
  }

  // Slight jitter for severity/confidence
  const severity_score = isDuplicate
    ? tpl.severity
    : Math.max(1, Math.min(10, tpl.severity + (i % 3 === 0 ? -1 : 0)));
  const confidence_score = Number(Math.max(0.35, Math.min(0.99, tpl.conf + ((i % 5) - 2) * 0.03)).toFixed(2));

  // Date spread across past 5 days
  const hoursAgo = Math.floor((247 - i) * 0.45);
  const createdAt = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();

  reports.push({
    id,
    tracking_code,
    reporter_name: repName,
    reporter_phone: repPhone,
    photo_url: samplePhotos[i % samplePhotos.length],
    video_url: null,
    text_description,
    transcript,
    location: loc,
    category: cat.name,
    severity_score,
    confidence_score,
    duplicate_of,
    model_name: 'llama-3.1-nemotron-nano-vl-8b-v1',
    gpu_type: 'NVIDIA L40S',
    latency_ms: 320 + (i % 180),
    status: i % 10 === 0 ? 'in_progress' : (i % 25 === 0 ? 'triaged' : 'reported'),
    created_at: createdAt
  });
}

fs.writeFileSync(path.resolve('data/seed_reports.json'), JSON.stringify(reports, null, 2));
console.log(`Generated ${reports.length} seed reports successfully.`);
