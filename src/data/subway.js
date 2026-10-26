// Simplified NYC subway trunk lines. Coordinates are real station locations
// (lat, lon); the map draws smoothed curves through them.

export const ROUTE_COLORS = {
  1: '#EE352E', 2: '#EE352E', 3: '#EE352E',
  4: '#00933C', 5: '#00933C', 6: '#00933C',
  7: '#B933AD',
  A: '#0039A6', C: '#0039A6', E: '#0039A6',
  B: '#FF6319', D: '#FF6319', F: '#FF6319', M: '#FF6319',
  G: '#6CBE45',
  J: '#996633', Z: '#996633',
  L: '#A7A9AC',
  N: '#FCCC0A', Q: '#FCCC0A', R: '#FCCC0A', W: '#FCCC0A',
  S: '#808183', SI: '#0039A6',
};

// Yellow bullets use black text, as on MTA signage.
export const DARK_TEXT_ROUTES = new Set(['N', 'Q', 'R', 'W']);

// Groups shown in the status list, in MTA trunk-line order.
export const ROUTE_GROUPS = [
  { id: '123', name: 'Broadway–7 Av', routes: ['1', '2', '3'] },
  { id: '456', name: 'Lexington Av', routes: ['4', '5', '6'] },
  { id: '7', name: 'Flushing', routes: ['7'] },
  { id: 'ACE', name: '8 Av', routes: ['A', 'C', 'E'] },
  { id: 'BDFM', name: '6 Av', routes: ['B', 'D', 'F', 'M'] },
  { id: 'G', name: 'Crosstown', routes: ['G'] },
  { id: 'JZ', name: 'Nassau St', routes: ['J', 'Z'] },
  { id: 'L', name: '14 St–Canarsie', routes: ['L'] },
  { id: 'NQRW', name: 'Broadway', routes: ['N', 'Q', 'R', 'W'] },
  { id: 'S', name: 'Shuttles', routes: ['S'] },
  { id: 'SI', name: 'Staten Island Railway', routes: ['SI'] },
];

export const LINES = [
  {
    id: '123', group: '123', color: '#EE352E', routes: ['1', '2', '3'],
    stops: [
      ['Van Cortlandt Park–242 St', 40.8893, -73.8989],
      ['231 St', 40.8789, -73.9049],
      ['Dyckman St', 40.8606, -73.9255],
      ['168 St', 40.8405, -73.9401],
      ['137 St–City College', 40.8221, -73.9537],
      ['125 St', 40.8158, -73.9585],
      ['116 St–Columbia University', 40.8079, -73.9641],
      ['96 St', 40.7937, -73.9722],
      ['72 St', 40.7785, -73.9819],
      ['59 St–Columbus Circle', 40.7681, -73.9819],
      ['Times Sq–42 St', 40.7553, -73.9871],
      ['34 St–Penn Station', 40.7506, -73.9910],
      ['14 St', 40.7377, -74.0002],
      ['Christopher St–Stonewall', 40.7334, -74.0029],
      ['Canal St', 40.7223, -74.0063],
      ['Chambers St', 40.7155, -74.0093],
      ['Fulton St', 40.7102, -74.0076],
      ['Wall St', 40.7068, -74.0091],
      ['Clark St', 40.6975, -73.9931],
      ['Borough Hall', 40.6930, -73.9899],
      ['Atlantic Av–Barclays Ctr', 40.6843, -73.9776],
      ['Grand Army Plaza', 40.6752, -73.9709],
      ['Eastern Pkwy–Brooklyn Museum', 40.6720, -73.9642],
      ['Franklin Av–Medgar Evers College', 40.6707, -73.9581],
      ['Crown Hts–Utica Av', 40.6688, -73.9329],
      ['New Lots Av', 40.6664, -73.8842],
    ],
  },
  {
    id: '456', group: '456', color: '#00933C', routes: ['4', '5', '6'],
    stops: [
      ['Woodlawn', 40.8860, -73.8787],
      ['Bedford Park Blvd–Lehman College', 40.8731, -73.8901],
      ['Fordham Rd', 40.8623, -73.9012],
      ['Burnside Av', 40.8534, -73.9076],
      ['161 St–Yankee Stadium', 40.8278, -73.9257],
      ['149 St–Grand Concourse', 40.8184, -73.9273],
      ['125 St', 40.8045, -73.9375],
      ['86 St', 40.7795, -73.9556],
      ['59 St', 40.7626, -73.9677],
      ['Grand Central–42 St', 40.7527, -73.9772],
      ['14 St–Union Sq', 40.7347, -73.9907],
      ['Astor Pl', 40.7300, -73.9910],
      ['Brooklyn Bridge–City Hall', 40.7131, -74.0040],
      ['Fulton St', 40.7102, -74.0076],
      ['Bowling Green', 40.7046, -74.0141],
      ['Borough Hall', 40.6930, -73.9899],
      ['Atlantic Av–Barclays Ctr', 40.6843, -73.9776],
    ],
  },
  {
    id: '7', group: '7', color: '#B933AD', routes: ['7'],
    stops: [
      ['34 St–Hudson Yards', 40.7556, -74.0021],
      ['Times Sq–42 St', 40.7553, -73.9871],
      ['5 Av', 40.7539, -73.9811],
      ['Grand Central–42 St', 40.7527, -73.9772],
      ['Vernon Blvd–Jackson Av', 40.7426, -73.9536],
      ['Hunters Point Av', 40.7423, -73.9488],
      ['Court Sq', 40.7471, -73.9455],
      ['Queensboro Plaza', 40.7509, -73.9402],
      ['33 St–Rawson St', 40.7449, -73.9307],
      ['46 St–Bliss St', 40.7432, -73.9185],
      ['61 St–Woodside', 40.7456, -73.9030],
      ['74 St–Broadway / Jackson Hts', 40.7467, -73.8913],
      ['Junction Blvd', 40.7493, -73.8695],
      ['111 St', 40.7516, -73.8553],
      ['Mets–Willets Point', 40.7546, -73.8457],
      ['Flushing–Main St', 40.7596, -73.8301],
    ],
  },
  {
    id: 'ACE', group: 'ACE', color: '#0039A6', routes: ['A', 'C'],
    stops: [
      ['Inwood–207 St', 40.8681, -73.9199],
      ['Dyckman St', 40.8655, -73.9271],
      ['190 St', 40.8590, -73.9342],
      ['168 St', 40.8406, -73.9396],
      ['145 St', 40.8241, -73.9445],
      ['125 St', 40.8111, -73.9524],
      ['59 St–Columbus Circle', 40.7681, -73.9819],
      ['42 St–Port Authority', 40.7573, -73.9898],
      ['34 St–Penn Station', 40.7523, -73.9932],
      ['14 St', 40.7400, -74.0021],
      ['W 4 St–Washington Sq', 40.7322, -74.0003],
      ['Canal St', 40.7209, -74.0053],
      ['Fulton St', 40.7102, -74.0076],
      ['High St', 40.6993, -73.9905],
      ['Jay St–MetroTech', 40.6923, -73.9873],
      ['Hoyt–Schermerhorn Sts', 40.6884, -73.9851],
      ['Nostrand Av', 40.6802, -73.9504],
      ['Utica Av', 40.6794, -73.9307],
      ['Broadway Junction', 40.6788, -73.9053],
      ['Euclid Av', 40.6753, -73.8722],
      ['Rockaway Blvd', 40.6804, -73.8433],
      ['Howard Beach–JFK Airport', 40.6604, -73.8304],
    ],
  },
  {
    id: 'E', group: 'ACE', color: '#0039A6', routes: ['E'],
    stops: [
      ['42 St–Port Authority', 40.7573, -73.9898],
      ['50 St', 40.7622, -73.9859],
      ['7 Av', 40.7628, -73.9810],
      ['5 Av/53 St', 40.7600, -73.9754],
      ['Lexington Av/53 St', 40.7573, -73.9690],
      ['Court Sq', 40.7471, -73.9455],
      ['Queens Plaza', 40.7489, -73.9373],
      ['74 St–Broadway / Jackson Hts', 40.7467, -73.8913],
      ['Elmhurst Av', 40.7424, -73.8822],
      ['Woodhaven Blvd', 40.7330, -73.8697],
      ['Forest Hills–71 Av', 40.7216, -73.8446],
      ['Kew Gardens–Union Tpke', 40.7140, -73.8310],
      ['Jamaica Center–Parsons/Archer', 40.7022, -73.8010],
    ],
  },
  {
    id: 'BDFM', group: 'BDFM', color: '#FF6319', routes: ['B', 'D', 'F', 'M'],
    stops: [
      ['Norwood–205 St', 40.8748, -73.8789],
      ['Bedford Park Blvd', 40.8732, -73.8875],
      ['Fordham Rd', 40.8614, -73.8975],
      ['Tremont Av', 40.8501, -73.9054],
      ['167 St', 40.8336, -73.9188],
      ['161 St–Yankee Stadium', 40.8278, -73.9257],
      ['145 St', 40.8241, -73.9445],
      ['125 St', 40.8111, -73.9524],
      ['59 St–Columbus Circle', 40.7681, -73.9819],
      ['7 Av', 40.7628, -73.9810],
      ['47–50 Sts–Rockefeller Ctr', 40.7586, -73.9813],
      ['42 St–Bryant Pk', 40.7544, -73.9843],
      ['34 St–Herald Sq', 40.7497, -73.9877],
      ['14 St', 40.7382, -73.9962],
      ['W 4 St–Washington Sq', 40.7322, -74.0003],
      ['Broadway–Lafayette St', 40.7252, -73.9962],
      ['2 Av', 40.7234, -73.9897],
      ['Delancey St–Essex St', 40.7186, -73.9884],
      ['East Broadway', 40.7138, -73.9902],
      ['York St', 40.7014, -73.9868],
      ['Jay St–MetroTech', 40.6923, -73.9873],
      ['Bergen St', 40.6861, -73.9907],
      ['Carroll St', 40.6803, -73.9951],
      ['7 Av', 40.6662, -73.9802],
      ['Church Av', 40.6441, -73.9796],
      ['Kings Hwy', 40.6031, -73.9722],
      ['Coney Island–Stillwell Av', 40.5773, -73.9811],
    ],
  },
  {
    id: 'G', group: 'G', color: '#6CBE45', routes: ['G'],
    stops: [
      ['Court Sq', 40.7471, -73.9455],
      ['Greenpoint Av', 40.7313, -73.9544],
      ['Nassau Av', 40.7244, -73.9512],
      ['Metropolitan Av / Lorimer St', 40.7134, -73.9508],
      ['Broadway', 40.7061, -73.9504],
      ['Flushing Av', 40.7003, -73.9503],
      ['Myrtle–Willoughby Avs', 40.6946, -73.9490],
      ['Bedford–Nostrand Avs', 40.6896, -73.9535],
      ['Classon Av', 40.6888, -73.9600],
      ['Clinton–Washington Avs', 40.6883, -73.9666],
      ['Fulton St', 40.6872, -73.9754],
      ['Hoyt–Schermerhorn Sts', 40.6884, -73.9851],
      ['Bergen St', 40.6861, -73.9907],
      ['Carroll St', 40.6803, -73.9951],
      ['7 Av', 40.6662, -73.9802],
      ['Church Av', 40.6441, -73.9796],
    ],
  },
  {
    id: 'JZ', group: 'JZ', color: '#996633', routes: ['J', 'Z'],
    stops: [
      ['Broad St', 40.7064, -74.0110],
      ['Fulton St', 40.7102, -74.0076],
      ['Chambers St', 40.7133, -74.0034],
      ['Canal St', 40.7181, -73.9999],
      ['Bowery', 40.7202, -73.9937],
      ['Delancey St–Essex St', 40.7186, -73.9884],
      ['Marcy Av', 40.7083, -73.9580],
      ['Hewes St', 40.7069, -73.9533],
      ['Lorimer St', 40.7039, -73.9476],
      ['Flushing Av', 40.7006, -73.9413],
      ['Myrtle Av', 40.6972, -73.9353],
      ['Kosciuszko St', 40.6930, -73.9286],
      ['Halsey St', 40.6866, -73.9164],
      ['Chauncey St', 40.6828, -73.9104],
      ['Broadway Junction', 40.6788, -73.9053],
      ['Cypress Hills', 40.6897, -73.8724],
      ['Woodhaven Blvd', 40.6934, -73.8516],
      ['121 St', 40.7003, -73.8283],
      ['Jamaica Center–Parsons/Archer', 40.7022, -73.8010],
    ],
  },
  {
    id: 'L', group: 'L', color: '#A7A9AC', routes: ['L'],
    stops: [
      ['8 Av', 40.7397, -74.0026],
      ['6 Av', 40.7375, -73.9966],
      ['14 St–Union Sq', 40.7347, -73.9905],
      ['3 Av', 40.7329, -73.9861],
      ['1 Av', 40.7307, -73.9815],
      ['Bedford Av', 40.7173, -73.9564],
      ['Metropolitan Av / Lorimer St', 40.7134, -73.9508],
      ['Graham Av', 40.7146, -73.9441],
      ['Grand St', 40.7116, -73.9406],
      ['Montrose Av', 40.7074, -73.9400],
      ['Morgan Av', 40.7062, -73.9331],
      ['Jefferson St', 40.7066, -73.9229],
      ['DeKalb Av', 40.7038, -73.9183],
      ['Myrtle–Wyckoff Avs', 40.6995, -73.9118],
      ['Halsey St', 40.6957, -73.9043],
      ['Wilson Av', 40.6889, -73.9043],
      ['Bushwick Av–Aberdeen St', 40.6826, -73.9054],
      ['Broadway Junction', 40.6788, -73.9053],
      ['Canarsie–Rockaway Pkwy', 40.6466, -73.9020],
    ],
  },
  {
    id: 'NQRW', group: 'NQRW', color: '#FCCC0A', routes: ['N', 'Q', 'R', 'W'],
    stops: [
      ['Astoria–Ditmars Blvd', 40.7752, -73.9120],
      ['Astoria Blvd', 40.7703, -73.9180],
      ['30 Av', 40.7666, -73.9214],
      ['Broadway', 40.7616, -73.9255],
      ['36 Av', 40.7566, -73.9296],
      ['39 Av–Dutch Kills', 40.7529, -73.9322],
      ['Queensboro Plaza', 40.7509, -73.9402],
      ['59 St', 40.7626, -73.9677],
      ['5 Av/59 St', 40.7643, -73.9731],
      ['57 St–7 Av', 40.7647, -73.9807],
      ['49 St', 40.7599, -73.9841],
      ['Times Sq–42 St', 40.7553, -73.9871],
      ['34 St–Herald Sq', 40.7497, -73.9877],
      ['23 St', 40.7413, -73.9893],
      ['14 St–Union Sq', 40.7347, -73.9905],
      ['8 St–NYU', 40.7305, -73.9925],
      ['Prince St', 40.7243, -73.9977],
      ['Canal St', 40.7190, -74.0001],
      ['City Hall', 40.7135, -74.0067],
      ['Cortlandt St', 40.7106, -74.0115],
      ['Whitehall St–South Ferry', 40.7032, -74.0130],
      ['Court St', 40.6941, -73.9918],
      ['Jay St–MetroTech', 40.6923, -73.9873],
      ['DeKalb Av', 40.6905, -73.9818],
      ['Atlantic Av–Barclays Ctr', 40.6843, -73.9776],
      ['36 St', 40.6551, -74.0036],
      ['59 St', 40.6414, -74.0179],
      ['Bay Ridge–95 St', 40.6166, -74.0307],
    ],
  },
  {
    id: 'Q2', group: 'NQRW', color: '#FCCC0A', routes: ['Q'],
    stops: [
      ['96 St', 40.7841, -73.9472],
      ['86 St', 40.7778, -73.9516],
      ['72 St', 40.7688, -73.9584],
      ['Lexington Av/63 St', 40.7649, -73.9663],
      ['57 St–7 Av', 40.7647, -73.9807],
    ],
  },
  {
    id: 'S', group: 'S', color: '#808183', routes: ['S'],
    stops: [
      ['Times Sq–42 St', 40.7553, -73.9871],
      ['Grand Central–42 St', 40.7527, -73.9772],
    ],
  },
];

// Placed away from the trunk lines so they don't cover stations.
export const BOROUGHS = [
  ['Manhattan', 40.795, -74.012],
  ['The Bronx', 40.852, -73.862],
  ['Queens', 40.722, -73.875],
  ['Brooklyn', 40.636, -73.945],
];

// Equirectangular projection centred on Midtown, scaled so the city spans
// roughly -1..1 world units on each axis.
const LAT0 = 40.735, LON0 = -73.955, K = Math.cos((LAT0 * Math.PI) / 180), SCALE = 11;
export function project(lat, lon) {
  return [(lon - LON0) * K * SCALE, -(lat - LAT0) * SCALE];
}

// Stops within ~160 m of each other are one station complex. Wider merges
// swallow neighbours like Jay St–MetroTech into Borough Hall.
const MERGE = 0.0015 * SCALE;

export function buildStations() {
  const stations = [];
  for (const line of LINES) {
    line.points = [];
    for (const [name, lat, lon] of line.stops) {
      const [x, z] = project(lat, lon);
      let st = stations.find((s) => Math.hypot(s.x - x, s.z - z) < MERGE);
      if (!st) {
        st = { id: stations.length, name, x, z, routes: new Set(), lines: new Set() };
        stations.push(st);
      }
      line.routes.forEach((r) => st.routes.add(r));
      st.lines.add(line.id);
      line.points.push({ x, z, station: st });
    }
  }
  for (const st of stations) {
    st.routes = sortRoutes([...st.routes]);
    st.lines = [...st.lines];
  }
  return stations;
}

const ORDER = Object.keys(ROUTE_COLORS);
export function sortRoutes(routes) {
  return routes.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}
