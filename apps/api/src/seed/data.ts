/** Static reference data for the demo seed. All people are fictional. */

export const DEMO_PASSWORD = 'Demo@1234';

export const TAGS: Record<string, string[]> = {
  Programming: ['Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'Go'],
  'Data & AI': ['Machine Learning', 'Deep Learning', 'Data Engineering', 'Statistics', 'SQL', 'NLP', 'Computer Vision', 'MLOps'],
  'Web & Cloud': ['React', 'Node.js', 'Cloud (AWS)', 'Kubernetes', 'System Design', 'Microservices', 'DevOps', 'Cybersecurity'],
  'Product & Business': ['Product Management', 'UX Research', 'Business Strategy', 'Corporate Finance', 'Marketing', 'Entrepreneurship', 'Fundraising', 'Consulting Case Prep'],
  Hardware: ['VLSI Design', 'Embedded Systems', 'IoT', 'Signal Processing', 'Robotics', '5G & Wireless'],
  Domain: ['Supply Chain', 'Quantitative Finance', 'Healthcare Technology', 'Power Systems', 'Renewable Energy', 'Civil Services Prep', 'Public Policy', 'Research Methods', 'GRE & Applications', 'Structural Engineering'],
};

export const INDUSTRY_PROFILES: Record<string, { roles: string[]; companies: string[]; tags: string[]; departments: string[] }> = {
  Software: {
    roles: ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Engineering Manager', 'Backend Engineer', 'Frontend Engineer'],
    companies: ['Northwind Systems', 'Bluepeak Software', 'Cobalt Labs', 'Helix Cloud', 'Orbital Apps'],
    tags: ['Java', 'Python', 'TypeScript', 'React', 'Node.js', 'System Design', 'Microservices', 'Cloud (AWS)', 'Go', 'Kubernetes'],
    departments: ['Computer Science & Engineering', 'Information Technology'],
  },
  'Data & AI': {
    roles: ['Data Scientist', 'Senior Data Scientist', 'Machine Learning Engineer', 'Data Engineer', 'AI Research Scientist', 'Analytics Manager'],
    companies: ['Quantia AI', 'Lumen Analytics', 'Deepfield Labs', 'Vectorworks Data', 'Insightly'],
    tags: ['Machine Learning', 'Deep Learning', 'Python', 'Statistics', 'SQL', 'NLP', 'Computer Vision', 'Data Engineering', 'MLOps'],
    departments: ['Computer Science & Engineering', 'Information Technology', 'Electronics & Communication'],
  },
  FinTech: {
    roles: ['Quantitative Analyst', 'Product Manager', 'Backend Engineer', 'Risk Analyst', 'Data Scientist'],
    companies: ['Ledgerline', 'PayArc', 'Fintrix Capital', 'Coinwise', 'Rupee Rails'],
    tags: ['Quantitative Finance', 'Python', 'Statistics', 'Corporate Finance', 'Java', 'System Design', 'Product Management', 'SQL'],
    departments: ['Computer Science & Engineering', 'Management Studies', 'Information Technology'],
  },
  Consulting: {
    roles: ['Management Consultant', 'Technology Consultant', 'Senior Business Analyst', 'Engagement Manager'],
    companies: ['Meridian Partners', 'Crestview Consulting', 'Apex Advisory', 'Stratwise'],
    tags: ['Consulting Case Prep', 'Business Strategy', 'Corporate Finance', 'Product Management', 'SQL', 'Marketing'],
    departments: ['Management Studies', 'Mechanical Engineering', 'Computer Science & Engineering'],
  },
  Healthcare: {
    roles: ['Biomedical Engineer', 'Healthcare Data Analyst', 'Product Manager', 'Clinical Software Engineer'],
    companies: ['MedAxis', 'CareGrid Health', 'Pulse Diagnostics', 'Genomix'],
    tags: ['Healthcare Technology', 'Python', 'Machine Learning', 'Product Management', 'Signal Processing', 'Research Methods'],
    departments: ['Electronics & Communication', 'Computer Science & Engineering'],
  },
  Manufacturing: {
    roles: ['Production Engineer', 'Supply Chain Manager', 'Quality Engineer', 'Plant Operations Manager'],
    companies: ['Tata Forge Works', 'Vulcan Industries', 'Precision Motors', 'Ironclad Manufacturing'],
    tags: ['Supply Chain', 'Robotics', 'IoT', 'Business Strategy', 'Embedded Systems'],
    departments: ['Mechanical Engineering', 'Electrical Engineering'],
  },
  'E-commerce': {
    roles: ['Product Manager', 'Senior Software Engineer', 'Growth Analyst', 'Category Manager'],
    companies: ['Cartly', 'ShopSphere', 'Bazaar Now', 'Kirana Cloud'],
    tags: ['Product Management', 'Marketing', 'SQL', 'React', 'System Design', 'UX Research', 'Statistics'],
    departments: ['Computer Science & Engineering', 'Management Studies', 'Information Technology'],
  },
  Semiconductors: {
    roles: ['VLSI Design Engineer', 'Verification Engineer', 'Embedded Systems Engineer', 'Physical Design Lead'],
    companies: ['Siliconix India', 'Wafergate', 'Nanocore Semiconductors', 'ChipVerse'],
    tags: ['VLSI Design', 'Embedded Systems', 'C++', 'Signal Processing', 'IoT'],
    departments: ['Electronics & Communication', 'Electrical Engineering'],
  },
  'Public Sector': {
    roles: ['Civil Services Officer', 'Policy Analyst', 'Scientist (Government R&D)'],
    companies: ['Government of India', 'State Planning Board', 'National Research Agency'],
    tags: ['Civil Services Prep', 'Public Policy', 'Research Methods', 'Structural Engineering'],
    departments: ['Civil Engineering', 'Mechanical Engineering', 'Electrical Engineering'],
  },
  'Research & Academia': {
    roles: ['Assistant Professor', 'Postdoctoral Researcher', 'Research Scientist'],
    companies: ['National Institute of Technology', 'Institute of Science', 'University of Toronto', 'ETH Zurich'],
    tags: ['Research Methods', 'GRE & Applications', 'Machine Learning', 'Signal Processing', 'Statistics'],
    departments: ['Computer Science & Engineering', 'Electronics & Communication', 'Civil Engineering'],
  },
  Telecom: {
    roles: ['Network Engineer', 'RF Engineer', '5G Solutions Architect'],
    companies: ['Jiotel Networks', 'Airwave Systems', 'Spectrum Telecom'],
    tags: ['5G & Wireless', 'Signal Processing', 'Embedded Systems', 'Cloud (AWS)'],
    departments: ['Electronics & Communication', 'Electrical Engineering'],
  },
  Energy: {
    roles: ['Power Systems Engineer', 'Renewable Energy Analyst', 'Grid Operations Manager'],
    companies: ['SunGrid Power', 'Greenvolt Energy', 'National Grid Services'],
    tags: ['Power Systems', 'Renewable Energy', 'IoT', 'Business Strategy'],
    departments: ['Electrical Engineering', 'Mechanical Engineering'],
  },
};

export const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Ananya', 'Diya', 'Priya', 'Kavya', 'Meera', 'Ishita', 'Saanvi', 'Riya', 'Neha', 'Pooja', 'Rahul', 'Karthik', 'Siddharth', 'Nikhil', 'Varun', 'Aisha', 'Fatima', 'Zoya', 'Imran', 'Farhan', 'Gurpreet', 'Harleen', 'Manpreet', 'Tenzin', 'Lakshmi', 'Deepa', 'Suresh', 'Vikram', 'Anjali', 'Tanvi', 'Joseph', 'Maria', 'Thomas', 'Divya', 'Nandini', 'Abhishek', 'Akash', 'Shreya', 'Sneha', 'Yash'];
export const LAST = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Patel', 'Gupta', 'Menon', 'Rao', 'Khan', 'Singh', 'Das', 'Banerjee', 'Mukherjee', 'Kulkarni', 'Joshi', 'Pillai', 'Chatterjee', 'Bose', 'Fernandes', 'DSouza', 'Agarwal', 'Mishra', 'Pandey', 'Hegde', 'Shetty', 'Kapoor', 'Malhotra', 'Bhat', 'Chopra'];
export const CITIES = ['Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Delhi NCR', 'Chennai', 'Kolkata', 'Ahmedabad', 'Singapore', 'London', 'San Francisco', 'Toronto', 'Berlin', 'Dubai'];

export const DEGREE_BY_DEPT: Record<string, string> = {
  'Computer Science & Engineering': 'B.Tech',
  'Electronics & Communication': 'B.Tech',
  'Electrical Engineering': 'B.Tech',
  'Mechanical Engineering': 'B.Tech',
  'Civil Engineering': 'B.Tech',
  'Information Technology': 'B.Tech',
  'Management Studies': 'MBA',
};

export const DEPT_CODE: Record<string, string> = {
  'Computer Science & Engineering': 'CS',
  'Electronics & Communication': 'EC',
  'Electrical Engineering': 'EE',
  'Mechanical Engineering': 'ME',
  'Civil Engineering': 'CE',
  'Information Technology': 'IT',
  'Management Studies': 'MB',
};

export const STUDENT_ROLE_TARGETS: Record<string, { roles: string[]; industries: string[]; areas: string[] }> = {
  'Computer Science & Engineering': { roles: ['Software Engineer', 'Data Scientist', 'Machine Learning Engineer', 'Product Manager', 'Backend Engineer'], industries: ['Software', 'Data & AI', 'FinTech', 'E-commerce'], areas: ['interview_prep', 'technical_skills', 'career_guidance', 'resume_review'] },
  'Information Technology': { roles: ['Software Engineer', 'Data Engineer', 'Cloud Engineer', 'Frontend Engineer'], industries: ['Software', 'Data & AI', 'E-commerce'], areas: ['interview_prep', 'technical_skills', 'resume_review'] },
  'Electronics & Communication': { roles: ['VLSI Design Engineer', 'Embedded Systems Engineer', 'Machine Learning Engineer', 'RF Engineer'], industries: ['Semiconductors', 'Telecom', 'Data & AI'], areas: ['technical_skills', 'higher_studies', 'career_guidance'] },
  'Electrical Engineering': { roles: ['Power Systems Engineer', 'Embedded Systems Engineer', 'Renewable Energy Analyst'], industries: ['Energy', 'Semiconductors', 'Manufacturing'], areas: ['career_guidance', 'industry_insight', 'higher_studies'] },
  'Mechanical Engineering': { roles: ['Production Engineer', 'Supply Chain Manager', 'Management Consultant'], industries: ['Manufacturing', 'Consulting', 'Energy'], areas: ['career_guidance', 'industry_insight', 'interview_prep'] },
  'Civil Engineering': { roles: ['Civil Services Officer', 'Structural Engineer', 'Policy Analyst'], industries: ['Public Sector', 'Research & Academia'], areas: ['career_guidance', 'higher_studies', 'industry_insight'] },
  'Management Studies': { roles: ['Product Manager', 'Management Consultant', 'Quantitative Analyst'], industries: ['Consulting', 'FinTech', 'E-commerce'], areas: ['interview_prep', 'networking', 'entrepreneurship', 'career_guidance'] },
};

export const MESSAGE_SNIPPETS = {
  student: [
    'Thanks for the session yesterday — I have started on the system design reading you suggested.',
    'I updated my resume with the project metrics we discussed. Could you take a look before Friday?',
    'Quick question: should I prioritise the internship offer or keep preparing for the off-campus drive?',
    'I finished two mock interviews this week. Feeling much more confident about behavioural questions.',
    'Could we move our next session to the weekend? I have mid-semester exams.',
  ],
  mentor: [
    'Great progress! Focus on one project story you can tell end to end — impact, trade-offs, what you would change.',
    'I left comments on the resume. Lead each bullet with the outcome, then the how.',
    'Take the internship — real production experience will matter more than one more round of practice.',
    'Nice work. For next time, pick one company and research their engineering blog.',
    'Weekend works. I have proposed two slots on the sessions tab.',
  ],
};
