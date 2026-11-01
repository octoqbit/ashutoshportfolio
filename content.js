// Details supplied by Ashutosh; project descriptions checked against his public repositories.
export const profile = {
  name: 'Ashutosh Yadav', email: 'aymail247@gmail.com',
  phone: '+91 78950 20802', phoneHref: '+917895020802',
  github: 'https://github.com/octoqbit',
  linkedin: 'https://www.linkedin.com/in/ashutosh-yadav-btkit',
  college: 'Bipin Tripathi Kumaon Institute of Technology',
  course: 'B.Tech in Electronics & Communication Engineering', year: 'Second year',
};
export const projects = [
  {
    slug: 'attendly', title: 'Attendly', type: 'Attendance management',
    label: 'SOFTWARE PROJECT', image: 'attendly-cover.jpg', color: '#e4eee9',
    description: 'An attendance-management app with student, faculty, and admin workflows.',
    idea: 'Attendly brings class management and attendance records into one place. My focus was on making the different student, faculty, and administrator workflows clear and easy to navigate.',
    collection: 'Software development', status: 'Live project',
    caption: 'Attendly — my attendance-management project.',
    detailTitle: 'One place for classes and attendance.',
    detail: 'The application brings together role-based dashboards, class management, and attendance logs. Its code also includes a face-scanning workflow and Supabase integration for authentication and records.',
    points: ['Student, faculty, and administrator views', 'Class management and attendance records', 'React interface with Supabase integration'],
    note: 'Built with React and JavaScript. Source code and the live project are linked below.',
    href: 'https://attendlytrack.vercel.app', linkLabel: 'Visit Attendly',
    repo: 'https://github.com/octoqbit/attendly',
  },
  {
    slug: 'tivzo', title: 'Tivzo', type: 'Event-management workspace',
    label: 'SOFTWARE PROJECT', image: 'tivzo-cover.png', color: '#e6ddce',
    description: 'An event workspace for registration, QR tickets, guest lists, and check-in.',
    idea: 'Tivzo explores how the moving parts of an event can fit into one workspace. It brings event setup, participant registration, tickets, and guest management together around the organiser’s workflow.',
    collection: 'Software development', status: 'In development',
    caption: 'Tivzo — event-management project artwork from my repository.',
    detailTitle: 'From registration to check-in.',
    detail: 'The project includes an organiser dashboard, registration pages, QR ticket previews, guest reports, and a continuous scanner. It separates sample workspace behaviour from the configured backend used for live events.',
    points: ['Event dashboards and registration pages', 'QR tickets, guest lists, and CSV reports', 'React and TypeScript with Supabase integration'],
    note: 'A development project with preview workflows and backend setup documented in the repository.',
    href: 'https://github.com/octoqbit/tivzo', linkLabel: 'Explore Tivzo on GitHub',
    repo: 'https://github.com/octoqbit/tivzo',
  },
  {
    slug: 'cygnus', title: 'CYGNUS', type: 'Technical club website',
    label: 'COMMUNITY PROJECT', image: 'cygnus-cover.jpg', color: '#11191e',
    description: 'The website for the technical club I run, connecting projects, events, and members.',
    idea: 'I run CYGNUS, a technical club, and built its website as a shared home for the community. The goal is to make the club’s projects, activities, and opportunities easier to discover.',
    collection: 'Software & community', status: 'Live project',
    caption: 'CYGNUS — The Technical Club website.',
    detailTitle: 'A home for the club.',
    detail: 'The site brings together public project and event previews, member workflows, a team directory, and a photo album. Administrative tools support publishing content and managing club applications.',
    points: ['Club projects, events, and community updates', 'Member applications and a public team directory', 'Admin workflows for content and club activity'],
    note: 'The source and live website are available below. CYGNUS is the technical club I run.',
    href: 'https://cygnusclub.vercel.app', linkLabel: 'Visit CYGNUS',
    repo: 'https://github.com/octoqbit/cygnus.club',
  },
];
export const practices = [
  { number: '01', title: 'Software & interfaces', subtitle: 'From logic to the interface.', text: 'I work with C, C++, React, and PostgreSQL, and use Git to manage my projects. Attendly, Tivzo, and the CYGNUS website are where I put that learning into practice.', tags: 'C · C++ · React · PostgreSQL · Git', image: 'skills-software.jpg', alt: 'Concept illustration of a laptop with code, interface layouts, and a database model.' },
  { number: '02', title: 'Electronics & robotics', subtitle: 'Code that meets the physical world.', text: 'As an ECE student, I’m interested in core electronics, microcontrollers, and robotics. I explore ESP32 and Arduino as a way to connect software with the physical world.', tags: 'Core electronics · ESP32 · Arduino · Robotics', image: 'skills-electronics.jpg', alt: 'Concept illustration of a microcontroller, breadboard, and robotic gripper.' },
  { number: '03', title: 'Community & creativity', subtitle: 'Learning with other people.', text: 'I run CYGNUS, a technical club, and hosted student meets during my Google Student Ambassador experience. Canva and CapCut are also part of my creative toolkit.', tags: 'CYGNUS · Student meets · Canva · CapCut', image: 'skills-community.jpg', alt: 'Concept illustration of a shared workshop table with laptops, sketches, and an electronics prototype.' },
];
export const skills = ['C', 'C++', 'React', 'PostgreSQL', 'Git', 'Canva', 'CapCut', 'ESP32', 'Arduino', 'Robotics'];
export const highlights = [
  { label: 'MAY — SEPTEMBER 2026', title: 'Google Student Ambassador', text: 'Hosted student meets and gained experience in communication, event coordination, and engaging with a student community.' },
  { label: 'COMMUNITY & LEADERSHIP', title: 'Running CYGNUS', text: 'I run CYGNUS, a technical club, and built its website to bring our projects, events, and community together.' },
  { label: 'COLLEGE TECHFEST', title: 'Two contest wins', text: 'Won two contests at my college’s techfest.' },
  { label: 'CERTIFICATION · CISCO', title: 'Introduction to IoT', text: 'Completed Cisco’s Introduction to IoT certification as part of my ongoing learning in connected technology.' },
];
export const routePaths = ['/', '/work/', '/practice/', '/about/', '/contact/', ...projects.map(p => `/work/${p.slug}/`)];
