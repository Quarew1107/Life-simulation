// United States country pack: Ohio's state rules with US national statistics. Money is in Year-1 US
// dollars (real money); money.scale tells the engine dollars are ~1.75x the size of its ringgit-sized
// units (js/data/countries/countries.js converts the money fields). Town and company names are fictional.
// Sources: IRS Rev. Proc. 2025-32 (2026 brackets, $16,100 standard deduction, $2,200 Child Tax Credit),
// SSA 2026 (wage base $184,500, bend points $1,286 / $7,749), Ohio 2026 (flat 2.75% above $26,050,
// $11.00 minimum wage, 5.75% state sales tax), USDA FNS FY2026 SNAP ($298 for one), BLS (Q2 2026 median
// full-time pay $1,251 a week, OEWS occupation pay), FBI 2025 crime, Census Bureau (ACS, income), Pew
// Religious Landscape Study 2023-24, Federal Reserve SCF 2022, KFF employer health benefits, the Fed.
(function (LES) {
  'use strict';
  const TOWN = 'Brightwater';
  LES.Countries.register({
    code: 'us',
    name: 'United States',
    adj: 'US',
    money: { symbol: '$', code: 'USD', name: 'dollars', scale: 1.75 },
    content: {
      townName: TOWN,
      castDefault: { first: 'Emily', last: 'Johnson', eth: 'white', skin: '#f1c8a0' },
      // Census Bureau 2024: White (non-Hispanic) 57.5%, Hispanic 19.5%, Black 12.1%, Asian 6.4%, other or several 4.5%.
      ethnicities: ['white', 'hispanic', 'black', 'asian', 'other'],
      ethnicNames: { white: 'White', hispanic: 'Hispanic', black: 'Black', asian: 'Asian', other: 'Other / multiracial' },
      ethnicMixes: {
        national: { keys: ['white', 'hispanic', 'black', 'asian', 'other'], w: [0.575, 0.195, 0.121, 0.064, 0.045] },
        classic: { keys: ['white', 'hispanic', 'black', 'asian', 'other'], w: [0.575, 0.195, 0.121, 0.064, 0.045] }, // Classic rules are Malaysia only
      },
      // Starting wealth by group: square root of the Federal Reserve SCF 2022 ratios of median family wealth
      // to White families (Black ~$45k, Hispanic ~$62k, White ~$285k), a mild gap as agreed; the average is unchanged.
      startWealth: { white: 1, hispanic: 0.46, black: 0.4, asian: 1.37, other: 0.61 },
      names: {
        white: {
          M: ['James', 'Michael', 'John', 'David', 'Chris', 'Matthew', 'Ryan', 'Tyler', 'Brandon', 'Kyle', 'Jacob', 'Logan', 'Ethan', 'Austin', 'Cody', 'Mason'],
          F: ['Emily', 'Jessica', 'Ashley', 'Sarah', 'Megan', 'Hannah', 'Lauren', 'Madison', 'Brittany', 'Amanda', 'Kayla', 'Olivia', 'Emma', 'Abigail', 'Rachel', 'Taylor'],
          last: ['Smith', 'Johnson', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Thompson', 'Moore', 'Taylor', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young', 'Wright', 'Baker', 'Kowalski', 'Schmidt'],
        },
        hispanic: {
          M: ['José', 'Luis', 'Carlos', 'Juan', 'Miguel', 'Jorge', 'Diego', 'Alejandro', 'Daniel', 'Adrián', 'Mateo', 'Javier'],
          F: ['María', 'Sofía', 'Isabella', 'Camila', 'Valeria', 'Daniela', 'Gabriela', 'Lucía', 'Ana', 'Natalia', 'Paola', 'Elena'],
          last: ['Garcia', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera'],
        },
        black: {
          M: ['Darnell', 'Marcus', 'Andre', 'Jamal', 'Malik', 'Terrence', 'Isaiah', 'Jaylen', 'DeShawn', 'Elijah', 'Xavier', 'Cedric'],
          F: ['Aaliyah', 'Imani', 'Jasmine', 'Keisha', 'Destiny', 'Brianna', 'Tiana', 'Monique', 'Ebony', 'Nia', 'Kiara', 'Shanice'],
          last: ['Washington', 'Jefferson', 'Jackson', 'Robinson', 'Harris', 'Brooks', 'Coleman', 'Freeman', 'Banks', 'Mitchell', 'Owens', 'Bell'],
        },
        asian: {
          M: ['Kevin', 'Jason', 'Wei', 'Hiroshi', 'Raj', 'Arjun', 'Minh', 'Joon', 'Andrew', 'Eric', 'Vikram', 'Daniel'],
          F: ['Grace', 'Jennifer', 'Mei', 'Priya', 'Linh', 'Yuna', 'Michelle', 'Ananya', 'Ji-woo', 'Emily', 'Christine', 'Sakura'],
          last: ['Nguyen', 'Kim', 'Patel', 'Chen', 'Lee', 'Wang', 'Tran', 'Park', 'Shah', 'Singh', 'Tanaka', 'Wong'],
        },
        other: {
          M: ['Jordan', 'Kai', 'Elias', 'Omar', 'Malakai', 'Noah', 'Tariq', 'Dakota'],
          F: ['Maya', 'Layla', 'Skye', 'Leilani', 'Amira', 'Jade', 'Sienna', 'Winona'],
          last: ['Begay', 'Yazzie', 'Haddad', 'Kealoha', 'Morales-Smith', 'Ali', 'Silva', 'Reyes-Brown'],
        },
      },
      // Rules revision 7 (Nov 2026): more first and family names (added to `names` in new worlds only, so older
      // worlds and saves keep exactly the names they had). Drawn from each country's naming registers and trends.
      namesMore: {
        white: {
          M: ["Liam", "Noah", "Oliver", "Henry", "Theodore", "Lucas", "Wyatt", "Owen", "Hudson", "Carter", "Grayson", "Benjamin", "William", "Jack", "Luke", "Caleb", "Hunter", "Dylan", "Nathan", "Andrew", "Joseph", "Robert", "Thomas", "Brian", "Kevin", "Scott", "Jeffrey", "Eric", "Steven", "Mark", "Zachary", "Garrett", "Bryce", "Colton", "Brody", "Connor"],
          F: ["Charlotte", "Amelia", "Harper", "Evelyn", "Avery", "Ella", "Scarlett", "Grace", "Chloe", "Lily", "Nora", "Hazel", "Aubrey", "Claire", "Natalie", "Samantha", "Elizabeth", "Katherine", "Jennifer", "Stephanie", "Nicole", "Heather", "Melissa", "Amber", "Kimberly", "Danielle", "Courtney", "Brooke", "Kelsey", "Morgan", "Paige", "Sydney", "Addison", "Riley", "Quinn", "Molly"],
          last: ["Brown", "Jones", "Williams", "Martin", "Allen", "King", "Scott", "Green", "Adams", "Nelson", "Hill", "Campbell", "Mitchell", "Roberts", "Carter", "Phillips", "Evans", "Turner", "Parker", "Collins", "Edwards", "Stewart", "Morris", "Murphy", "Cook", "Rogers", "Morgan", "Cooper", "Peterson", "Reed", "Bailey", "Kelly", "Howard", "Olson", "Larson", "Novak", "Russo"],
        },
        hispanic: {
          M: ["Santiago", "Sebastián", "Emiliano", "Leonardo", "Gabriel", "Ángel", "Fernando", "Ricardo", "Eduardo", "Francisco", "Andrés", "Manuel", "Rafael", "Antonio", "Roberto", "Héctor", "Pedro", "Raúl", "Óscar", "Iván", "Julián", "Cristian", "Joaquín", "Nicolás", "Emanuel", "Isaac", "Josué", "Kevin"],
          F: ["Valentina", "Mía", "Ximena", "Renata", "Victoria", "Regina", "Fernanda", "Andrea", "Mariana", "Alejandra", "Carolina", "Adriana", "Verónica", "Patricia", "Rosa", "Guadalupe", "Leticia", "Claudia", "Mónica", "Diana", "Jimena", "Emilia", "Luciana", "Paula", "Esmeralda", "Yesenia", "Karla", "Brenda"],
          last: ["Gomez", "Diaz", "Cruz", "Morales", "Reyes", "Gutierrez", "Ortiz", "Chavez", "Ramos", "Ruiz", "Alvarez", "Mendoza", "Castillo", "Jimenez", "Moreno", "Romero", "Herrera", "Medina", "Aguilar", "Vargas", "Castro", "Vasquez", "Soto", "Delgado"],
        },
        black: {
          M: ["Jordan", "Brandon", "Christopher", "Michael", "Anthony", "Darius", "Tyrone", "Reginald", "Jerome", "Kendrick", "Dante", "Khalil", "Tremaine", "Lamar", "Devonte", "Jalen", "Trevon", "Cameron", "Josiah", "Micah", "Amari", "Kingston", "Zion", "Desmond", "Rashad", "Terrell", "Kwame", "Ibrahim"],
          F: ["Kennedy", "Nevaeh", "Aniyah", "Zaria", "Jada", "Brianna", "Taliyah", "Ayana", "Kendra", "Tamika", "Latoya", "Shanice", "Dominique", "Ciara", "Raven", "Asia", "Janelle", "Tanisha", "Danielle", "Gabrielle", "Maya", "Sanaa", "Amara", "Zuri", "Kayla", "Tierra", "Alexis", "Makayla"],
          last: ["Johnson", "Williams", "Brown", "Jones", "Davis", "Thomas", "Moore", "Taylor", "Anderson", "White", "Jenkins", "Simmons", "Wallace", "Hayes", "Bryant", "Griffin", "Russell", "Henderson", "Foster", "Perry", "Graham", "Gaines", "Battle", "Okafor"],
        },
        asian: {
          M: ["Brian", "Justin", "Ryan", "Andy", "Jonathan", "Ethan", "Aaron", "Kenji", "Takeshi", "Haruto", "Min-jun", "Seo-jun", "Duc", "Huy", "Tuan", "Quang", "Rohan", "Aditya", "Sanjay", "Rahul", "Paolo", "Marco", "Miguel", "Jun", "Hao", "Tenzin"],
          F: ["Vivian", "Angela", "Karen", "Tiffany", "Cindy", "Annie", "Jessica", "Hana", "Aiko", "Yuki", "Seo-yeon", "Min-ji", "Mai", "Thao", "Lan", "Anh", "Kavya", "Isha", "Shreya", "Divya", "Maricel", "Joy", "Kristine", "Lin", "Xin", "Pema"],
          last: ["Le", "Pham", "Huynh", "Vu", "Choi", "Lim", "Kang", "Yamamoto", "Nakamura", "Sato", "Gupta", "Reddy", "Kumar", "Santos", "Reyes", "Cruz", "Liu", "Zhang", "Huang", "Wu", "Lin", "Yang"],
        },
        other: {
          M: ["Ahanu", "Takoda", "Kekoa", "Kainoa", "Bilal", "Karim", "Nasser", "Eli", "River", "Phoenix", "Ezra", "Gabriel", "Aiden", "Jaxon"],
          F: ["Aiyana", "Kaya", "Nalani", "Kalani", "Mariam", "Yasmin", "Rana", "Luna", "Aurora", "Sage", "Zoe", "Naomi", "Lena", "Ariana"],
          last: ["Tsosie", "Benally", "Nakai", "Kahale", "Akana", "Mansour", "Khalil", "Saleh", "Ortiz-Lee", "Nguyen-Smith", "Abboud", "Redcloud"],
        },
      },
      skin: {
        white: ['#f6d5b5', '#f1c8a0', '#ecbc96'],
        hispanic: ['#d29a5e', '#c68642', '#e0ac69'],
        black: ['#8d5524', '#6b3e1f', '#7a4a22'],
        asian: ['#f1c27d', '#e8b98a', '#e0ac69'],
        other: ['#c68642', '#b5763a', '#d29a5e'],
      },
      // College: in-state public tuition ~$11,600 a year; community college ~$4,000.
      quals: { VOC: 'Associate Degree', BACH_GEN: 'Bachelor of Arts', BACH_BUS: 'Bachelor of Business (BBA)', BACH_ENG: 'BS Engineering', MED: 'Doctor of Medicine (MD)', MASTER: "Master's Degree", BACH_SCI: 'BS Applied Science', BACH_CS: 'BS Computer Science', BACH_ARCH: 'Bachelor of Architecture (BArch)', BACH_LAW: 'Juris Doctor (JD, after a BA)', BACH_PHARM: 'Doctor of Pharmacy (PharmD)', BACH_SOC: 'Bachelor of Social Work (BSW)' },
      courses: {
        VOC: { name: 'Associate Degree (community college)', fee: 8000, months: 24 },
        BACH_GEN: { name: 'Bachelor of Arts', fee: 46400, months: 48 },
        BACH_BUS: { name: 'Bachelor of Business Administration', fee: 46400, months: 48 },
        BACH_ENG: { name: 'BS Engineering', fee: 50000, months: 48 },
        MED: { name: 'Medical school (MD)', fee: 240000, months: 60 },
        MASTER: { name: "Master's Degree", fee: 30000, months: 24 },
        BACH_SCI: { name: 'BS Applied Science', fee: 46400, months: 48 },
        BACH_CS: { name: 'BS Computer Science', fee: 48700, months: 48 },
        BACH_ARCH: { name: 'Bachelor of Architecture (BArch)', fee: 58000, months: 60 },
        BACH_LAW: { name: 'Juris Doctor (JD, after a BA)', fee: 190000, months: 84 },
        BACH_PHARM: { name: 'Doctor of Pharmacy (PharmD)', fee: 180000, months: 72 },
        BACH_SOC: { name: 'Bachelor of Social Work (BSW)', fee: 44000, months: 48 },
      },
      // Jobs: monthly pay in Year-1 USD (BLS OEWS medians, rounded).
      jobs: {
        cleaner: { title: 'Janitor', salary: 3000, freq: 10 },
        retail: { title: 'Retail Associate', salary: 2850, freq: 10 },
        rider: { title: 'Delivery Driver', salary: 3750, freq: 8 },
        factory: { title: 'Production Worker', salary: 3600, freq: 10 },
        construction: { title: 'Construction Laborer', salary: 3900, freq: 7 },
        sales: { title: 'Sales Representative', salary: 4800, freq: 6 },
        chef: { title: 'Cook', salary: 3000, freq: 5 },
        mechanic: { title: 'Auto Technician', salary: 4200, freq: 5 },
        electrician: { title: 'Electrician', salary: 5200, freq: 4 },
        nurse: { title: 'Registered Nurse', salary: 7750, freq: 4 },
        teacher: { title: 'Teacher', salary: 5500, freq: 4 },
        accountant: { title: 'Accountant', salary: 6750, freq: 3 },
        banker: { title: 'Loan Officer', salary: 5800, freq: 2 },
        engineer: { title: 'Engineer', salary: 8300, freq: 3 },
        softdev: { title: 'Software Developer', salary: 11000, freq: 3 },
        manager: { title: 'General Manager', salary: 8750, freq: 1.5 },
        doctor: { title: 'Physician', salary: 20000, freq: 1.5 },
        cityretail: { title: 'City Store Manager', salary: 4500, freq: 1.5 },
        citycorp: { title: 'City Office Analyst', salary: 6500, freq: 1.5 },
        citytech: { title: 'City Software Engineer', salary: 13000, freq: 1 },
        // Expansion 1 (rules revision 5): how common each is comes from content.js, rescaled per entry level.
        waiter: { title: 'Restaurant Server', salary: 2900 },
        barista: { title: 'Barista', salary: 2700 },
        security: { title: 'Security Guard', salary: 3400 },
        warehouseop: { title: 'Warehouse Associate', salary: 3500 },
        careasst: { title: 'Care Aide', salary: 3100 },
        plumber: { title: 'Plumber', salary: 5200 },
        carpenter: { title: 'Carpenter', salary: 4600 },
        hairdresser: { title: 'Hairdresser', salary: 3200 },
        busdriver: { title: 'Bus Driver', salary: 4300 },
        itsupport: { title: 'IT Support Specialist', salary: 5000 },
        labtech: { title: 'Laboratory Technician', salary: 4500 },
        pharmacist: { title: 'Pharmacist', salary: 11000 },
        paramedic: { title: 'Paramedic', salary: 4300 },
        firefighter: { title: 'Firefighter', salary: 5000 },
        architect: { title: 'Architect', salary: 8000 },
        lawyer: { title: 'Lawyer', salary: 12000 },
        socialworker: { title: 'Social Worker', salary: 5000 },
        scientist: { title: 'Research Scientist', salary: 8500 },
        analyst: { title: 'Data Analyst', salary: 8000 },
        journalist: { title: 'Journalist', salary: 5000 },
        equiptech: { title: 'Research Equipment Technician', salary: 5000 },
        envofficer: { title: 'Environmental Monitoring Technician', salary: 4400 },
        researchcoord: { title: 'Research Project Coordinator', salary: 6200 },
      },
      govJobs: {
        police: { title: 'Police Officer', salary: 6000 },
        treasurer: { title: 'Finance Director', salary: 12000 },
        community: { title: 'Director of Community Services', salary: 10000 },
      },
      gigs: {
        labour: { name: 'Day labor job', pay: 150 },
        delivery: { name: 'Food delivery (app)', pay: 110 },
        ehailing: { name: 'Rideshare driver', pay: 180 },
        pasar: { name: "Farmers' market helper", pay: 100 },
        tuition: { name: 'Tutoring', pay: 120 },
        repair: { name: 'Handyman job', pay: 200 },
        freelance: { name: 'Freelance coding', pay: 450 },
        promoter: { name: 'Event staff', pay: 140 },
      },
      trainings: {
        library: { name: 'Self-study at library', cost: 0 },
        gym: { name: 'Gym workout', cost: 10 },
        sports: { name: 'Pickup basketball & boxing', cost: 10 },
        speaking: { name: 'Public speaking club', cost: 15 },
        running: { name: 'Running at the park', cost: 0 },
      },
      tiers: {
        food: [
          { name: 'Cook at home', cost: 350, fx: 'Cheap; slowly hurts health & energy' },
          { name: 'Groceries & fast food', cost: 600, fx: 'Baseline' },
          { name: 'Healthy diet', cost: 900, fx: '+health, +energy' },
          { name: 'Fine dining', cost: 2200, fx: '+health, -stress, +prestige' },
        ],
        housing: [
          { name: 'Trailer park lot', cost: 800, fx: 'Poor sleep, more stress' },
          { name: 'Apartment', cost: 1300, fx: 'Baseline' },
          { name: 'Clapboard house', cost: 1900, fx: 'Better sleep' },
          { name: 'Downtown condo', cost: 2800, fx: 'Great sleep, +prestige' },
          { name: 'Suburban home', cost: 5000, fx: 'Best sleep, ++prestige' },
        ],
        transport: [
          { name: 'Bus & walking', cost: 70, fx: 'Tiring; no vehicle gigs' },
          { name: 'Used car', cost: 450, fx: 'Unlocks delivery gigs; small accident risk' },
          { name: 'New car', cost: 850, fx: 'Unlocks rideshare' },
          { name: 'Luxury SUV', cost: 2000, fx: '+prestige' },
        ],
        leisure: [
          { name: 'None', cost: 0, fx: 'Stress builds up' },
          { name: 'Streaming & bars', cost: 250, fx: 'Baseline' },
          { name: 'Gym membership', cost: 300, fx: 'Keeps body fit, -stress' },
          { name: 'Country club', cost: 2500, fx: 'Networking: more business luck' },
        ],
      },
      childCost: 800,
      childCostPerHousing: 250,
      simpleTaxBands: [[1342, 0], [5542, 0.19], [10150, 0.3], [Infinity, 0.4]], // federal + FICA + state, monthly
      corpTax: 0.21,
      biz: {
        stall: { name: 'Food Truck', capital: 26000, scale0: 16000, cap: 88000, fixed: 1050, names: ['Tacos', 'BBQ', 'Hot Dogs', 'Coffee', 'Burgers', 'Lemonade'] },
        workshop: { name: 'Auto Shop', capital: 70000, scale0: 31500, cap: 440000, fixed: 2600, names: ['Auto Repair', 'Tire & Lube', 'Body Shop', 'Machine Works'] },
        retail: { name: 'Store', capital: 105000, scale0: 52500, cap: 1050000, fixed: 4400, names: ['General Store', 'Outfitters', 'Electronics', 'Dollar Store', 'Books', 'Pharmacy'] },
        restaurant: { name: 'Restaurant', capital: 262500, scale0: 122500, cap: 5250000, fixed: 10500, names: ['Grill', 'Steakhouse', 'Pizzeria', 'Bistro', 'Taqueria'] },
        trading: { name: 'Wholesale Company', capital: 437500, scale0: 262500, cap: 26250000, fixed: 17500, names: ['Trading Co.', 'Import Export', 'Holdings', 'Logistics'] },
        tech: { name: 'Tech Startup', capital: 210000, scale0: 26250, cap: 52500000, fixed: 10500, names: ['Tech', 'Labs', 'Digital', 'AI', 'Apps', 'Robotics'] },
        property: { name: 'Property Developer', capital: 1750000, scale0: 525000, cap: 35000000, fixed: 52500, names: ['Homes', 'Development', 'Land Co.', 'Realty'] },
        clinic: { name: 'Private Clinic', capital: 350000, scale0: 78750, cap: 700000, fixed: 5250, names: ['Family Practice', 'Urgent Care', 'Dental', 'Medical Group'] },
        privschool: { name: 'Private School', capital: 2625000, scale0: 210000, cap: 5250000, fixed: 35000, fee: 1800, names: ['Academy', 'Prep School', 'Day School', 'Christian Academy'] },
        privhosp: { name: 'Private Hospital', capital: 7000000, scale0: 612500, cap: 21000000, fixed: 70000, names: ['Medical Center', 'Health System', 'Surgical Hospital'] },
      },
      depositRates: { growth: 0.04, normal: 0.035, recession: 0.015 },
      venues: {
        park: { name: 'Park', cost: 0 },
        futsal: { name: 'Rec center court', cost: 10 },
        mamak: { name: 'Diner', cost: 15 },
        mall: { name: 'Mall', cost: 60 },
        cinema: { name: 'Movie theater', cost: 25 },
        bowling: { name: 'Bowling', cost: 40 },
        karaoke: { name: 'Bar & karaoke', cost: 60 },
        finedine: { name: 'Fine dining', cost: 250 },
        spa: { name: 'Spa', cost: 200 },
        lounge: { name: 'Rooftop bar', cost: 150 },
        golf: { name: 'Country club golf', cost: 300 },
      },
      // Liberty Exchange: fictional listed companies (price in USD, shares in millions). No state-owned companies.
      stocks: [
        { tk: 'PSTB', name: 'Prairiestone Bank', sector: 'Finance', price0: 42, sharesM: 400, beta: 1, idio: 0.14, drift: 0.005, colour: '#5aa9e6' },
        { tk: 'BLWT', name: 'Bluewheat Farms', sector: 'Agriculture', price0: 28, sharesM: 300, beta: 0.7, idio: 0.18, drift: 0, colour: '#57d38c' },
        { tk: 'LNFT', name: 'Lanternfield Telecom', sector: 'Telco', price0: 19, sharesM: 500, beta: 0.8, idio: 0.13, drift: 0, colour: '#b892ff' },
        { tk: 'QMRK', name: 'Quillmark Software', sector: 'Technology', price0: 65, sharesM: 600, beta: 1.5, idio: 0.38, drift: 0.02, colour: '#3ec7b5' },
        { tk: 'ELMH', name: 'Elmshade Homes', sector: 'Property', price0: 24, sharesM: 700, beta: 1.4, idio: 0.22, drift: -0.005, colour: '#f4a261' },
        { tk: 'MRGT', name: 'Marrowgate Markets', sector: 'Consumer', price0: 36, sharesM: 250, beta: 0.9, idio: 0.15, drift: 0, colour: '#f28482' },
        { tk: 'ASHV', name: 'Ashvale Energy', sector: 'Energy', price0: 55, sharesM: 350, beta: 1.1, idio: 0.25, drift: 0, colour: '#e9c46a' },
        { tk: 'KSMR', name: 'Kestrelmoor Pharma', sector: 'Healthcare', price0: 88, sharesM: 300, beta: 0.6, idio: 0.24, drift: 0.005, colour: '#ff8c42' },
      ],
      ipoPool: [
        { tk: 'THSL', name: 'Thistlerun Logistics', sector: 'Logistics', sharesM: 300, beta: 1, idio: 0.22, drift: 0, colour: '#90be6d' },
        { tk: 'SNFW', name: 'Sunfallow Solar', sector: 'Energy', sharesM: 400, beta: 1.3, idio: 0.35, drift: 0.01, colour: '#ffd166' },
        { tk: 'GLMB', name: 'Glimmerbrook Biotech', sector: 'Healthcare', sharesM: 250, beta: 0.9, idio: 0.32, drift: 0, colour: '#ef476f' },
        { tk: 'CLDH', name: 'Cloudhollow Software', sector: 'Technology', sharesM: 500, beta: 1.5, idio: 0.4, drift: 0.02, colour: '#118ab2' },
        { tk: 'STFW', name: 'Stonefurrow Builders', sector: 'Construction', sharesM: 350, beta: 1.3, idio: 0.25, drift: -0.005, colour: '#b5838d' },
        { tk: 'BTKN', name: 'Butterknoll Foods', sector: 'Consumer', sharesM: 300, beta: 0.8, idio: 0.16, drift: 0, colour: '#f28482' },
        { tk: 'CRNK', name: 'Corncrake Agri', sector: 'Agriculture', sharesM: 400, beta: 0.7, idio: 0.2, drift: 0, colour: '#57cc99' },
        { tk: 'WRNH', name: 'Wrenhaven Insurance', sector: 'Finance', sharesM: 300, beta: 0.9, idio: 0.14, drift: 0, colour: '#4361ee' },
      ],
      glcStocks: [],
    },
    town: {
      townNames: [TOWN, 'Harlow Junction', 'Cedar Bend'],
      buildings: {
        office: 'Brightwater Tower', office2: 'Commerce Center', bank: 'Bank', bursa: 'Liberty Exchange', techhub: 'Tech Hub', researchcentre: 'Research & Innovation Center',
        mall: 'Brightwater Mall', mamak: 'Diner', hawker: 'Food Hall', mamak2: 'Corner Diner', university: 'Brightwater State University',
        kolej: 'Community College', library: 'Public Library', hall: 'Community Center', hospital: 'County Hospital', school: 'Public School',
        park: 'City Park', gym: 'Rec Center', factory: 'Plant', workshop: 'Auto Shop', warehouse: 'Distribution Center', construction: 'Construction Site',
        welfare: 'Children’s Services', depot: 'Bus Station', memorial: 'Memorial Garden', plaza: 'Town Square', field: 'Ball Field', garden: 'Garden',
        cinema: 'Movie Theater', karaoke: 'The Lucky Horseshoe', bowling: 'Bowling', futsal: 'Rec Court', finedine: 'The Chophouse', lounge: 'Rooftop Bar',
        spa: 'Spa', masjid: 'Islamic Center', tokong: 'Buddhist Temple', kuil: 'Hindu Temple', gereja: 'First Baptist Church',
        police: 'Police Department', jail: 'County Jail', court: 'Municipal Court', prison: 'State Correctional Institution', rehab: 'Recovery Center',
        townhall: 'City Hall', padang: 'Fairgrounds', golf: 'Brightwater Country Club', station: 'Train Station', padi: 'Farmland', hq: 'Tower',
        privschool: 'Private School', privhosp: 'Private Hospital',
      },
      scenery: {
        lake: ['Willow Lake', 'Miller Reservoir', 'Crane Pond', 'Mirror Lake'],
        hill: ['Lookout Hill', 'Pine Ridge', 'Bald Knob', 'Eagle Bluff'],
        forest: ['State Forest', 'Hickory Woods', 'Deer Creek Preserve'],
      },
      busLine: 'Route',
      signs: {
        SEWA: 'FOR LEASE', // an empty shop lot waiting for a tenant
        'HAWKER CENTRE': 'FOOD HALL', 'UNIVERSITI REZEKI': 'STATE UNIVERSITY', 'KOLEJ VOKASIONAL': 'COMMUNITY COLLEGE', DEWAN: 'COMMUNITY CENTER',
        BURSA: 'LIBERTY EXCHANGE', 'REZEKI MALL': 'BRIGHTWATER MALL', HOSPITAL: 'COUNTY HOSPITAL', SEKOLAH: 'PUBLIC SCHOOL', KILANG: 'PLANT',
        BENGKEL: 'AUTO SHOP', GUDANG: 'DISTRIBUTION', 'TAPAK BINAAN': 'CONSTRUCTION', STADIUM: 'REC CENTER', 'RUMAH KEBAJIKAN': "CHILDREN'S SERVICES",
        'SAWAH PADI': 'FARMLAND', 'DEPOT BAS': 'BUS STATION', 'TAMAN KENANGAN': 'MEMORIAL', 'TANAH DIJUAL': 'FOR SALE', TOKONG: 'BUDDHIST TEMPLE',
        KUIL: 'HINDU TEMPLE', POLIS: 'POLICE', LOKAP: 'COUNTY JAIL', 'DEWAN BANDARAYA': 'CITY HALL', PADANG: 'FAIRGROUNDS', MAHKAMAH: 'COURT',
        PENJARA: 'STATE PRISON', PEMULIHAN: 'RECOVERY', PAWAGAM: 'MOVIES', 'KARAOKE & BAR': 'LUCKY HORSESHOE', FUTSAL: 'REC COURT',
        'RESTORAN MEWAH': 'CHOPHOUSE', 'SKY LOUNGE': 'ROOFTOP BAR', 'KELAB GOLF': 'COUNTRY CLUB', 'STESEN KERETAPI': 'STATION',
        'LADANG SAWIT': 'FARMLAND', HUTAN: 'WOODS', PPR: 'APARTMENTS', TAMAN: 'GARDENS', 'TAMAN TASIK': 'CITY PARK', MENARA: 'OFFICES',
      },
      mapSizeNames: { kampung: 'Hamlet', pekan: 'Village', bandar: 'Town', bandaraya: 'City', metropolis: 'Metro' },
      townTypeNames: { mixed: 'Mixed town', capital: 'Business city', industrial: 'Factory town', university: 'College town', resort: 'Lake resort', farming: 'Farm town' },
      kindInfo: {
        kampung: 'A trailer park: mobile homes on rented lots. The cheapest housing in town.',
        flat: 'An apartment complex: garden apartments for working families.',
        terrace: 'A street of clapboard houses with porches. Comfortable homes.',
        condo: 'A downtown condo tower with a gym. Upper-middle-class living.',
        bungalow: 'A suburban home: big lawn, two-car garage. Home of the wealthy.',
        mamak: 'The diner, open late. Where people meet friends, gossip and fall in love.',
        hawker: 'Food hall and food trucks: cheap food and delivery gigs.',
        university: 'Brightwater State University: degrees in Arts, Business, Engineering, Medicine and Masters.',
        kolej: 'Community college: associate degrees and trades.',
        library: 'Public library: self-study, tutoring gigs and freelance work.',
        hall: 'Community center: public speaking club, events and faith groups.',
        hq: 'Headquarters tower of one of the richest companies in town.',
        office: 'Office building: sales, accounting and management jobs; home to bigger companies.',
        bank: 'Bank: business loans and loan officer jobs.',
        bursa: 'Liberty Exchange, the stock exchange. Click to open the stock market.',
        mall: 'The mall: retail and janitor jobs, event staff and rideshare gigs.',
        shoplot: 'A storefront for a small business.',
        hospital: 'County hospital: doctors, nurses and treatment. What you pay depends on your insurance.',
        lake: 'A lake: a walk round the shore, fishing off the dock, picnics. Not built on.',
        hill: 'A wooded hill with a trail and a lookout at the top. Not built on.',
        forest: 'State forest with a creek and a waterfall. Not built on.',
        privschool: 'A private school, owned by a resident. Fee-paying families send their children here; the owner pays the teachers.',
        privhosp: 'A private hospital, owned by a resident. It earns from insured and paying patients; the owner pays the doctors and nurses.',
        school: 'Public school: where children spend their days.',
        factory: 'Plant: production worker and engineer jobs.',
        workshop: 'Auto shop: technicians and repair gigs.',
        warehouse: 'Distribution center: delivery drivers and logistics.',
        construction: 'Construction site: hard, risky labor.',
        park: 'City park: for running and socialising.',
        gym: 'Rec center: workouts and sports training.',
        techhub: 'Tech hub: software jobs and startups.',
        researchcentre: 'Research & innovation center: laboratory, data and research jobs.',
        welfare: "Children's services: a group home for children without guardians.",
        padi: 'Corn and soybean fields.',
        lot: 'Empty land. New buildings appear here when the town gets crowded.',
        depot: 'Bus station and the town gateway. Newcomers arrive here.',
        memorial: 'Memorial garden. A candle for every founder who has passed away.',
        cinema: 'Movie theater. Mid-tier entertainment.',
        karaoke: 'The bar: drinks, pool and karaoke with friends. Mid-tier entertainment.',
        bowling: 'Bowling alley. Mid-tier entertainment.',
        futsal: 'Rec court: pickup games with friends. Low-tier sport and leisure.',
        finedine: 'A steakhouse. High-tier: expensive, very satisfying, a place to be seen.',
        lounge: 'Rooftop bar. High-tier nightlife where the well-off network.',
        spa: 'Spa: high-tier relaxation that melts stress away.',
        golf: 'Country club. The most exclusive venue in town: members only, where deals are made.',
        station: 'Train station: trains to the big city. Newcomers arrive and leavers depart here; commuters ride to city jobs.',
        rail: 'Railroad to the big city.',
        masjid: 'Islamic center: Friday prayers, the zakat fund, Ramadan and Eid.',
        tokong: 'Buddhist temple: meditation, offerings and a welfare fund.',
        kuil: 'Hindu temple: prayers, Diwali and the temple welfare fund.',
        gereja: 'Church: Sunday service, the food pantry and the church welfare fund.',
        police: 'Police department. Patrol cars go out from here; arrest chances depend on police strength.',
        court: 'Municipal court. Most cases end in a plea deal; a lawyer helps those who can pay.',
        prison: 'State prison. Inmates lose their jobs; a record makes hiring harder and reoffending likelier.',
        jail: 'County jail: suspects wait here until the court hears their case.',
        townhall: 'City hall, office of the elected mayor. The city collects taxes and pays for police, aid and services.',
        padang: 'The fairgrounds, where election rallies gather.',
        rehab: 'Recovery center: drug treatment. Many relapse after leaving.',
      },
    },
    names: {
      centralBank: 'The Fed', policyRate: 'federal funds rate', fund: 'Brightwater Rainy Day Fund', fundReturns: 'rainy-day fund returns',
      exchange: 'Liberty Exchange', exchangeShort: 'Liberty', retirement: '401(k)', antiCorruption: 'FBI', lockdown: 'Stay-at-home order', newspaper: 'The Brightwater Gazette',
    },
    // Taxes (Year-1 USD a year). Federal 2026 brackets for a single filer on taxable income, $16,100 standard
    // deduction, 401(k) contributions pre-tax; FICA 7.65% (6.2% Social Security up to $184,500 + 1.45%
    // Medicare) from worker and employer; Ohio 2.75% above $26,050 and a 2% city income tax; sales tax
    // 7.25% (state 5.75% + county) with groceries exempt; property tax (about 15% of housing costs, through
    // rents); corporate tax 21%; qualified dividends 15% above ~$49,450; federal estate tax 40% above $15M.
    tax: {
      incomeBands: [[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
      personalRelief: 16100,
      retirementRelief: { rate: 0.06, cap: 24500 },
      childRelief: 0,
      rebate: { amount: 0, upTo: 0 },
      ni: { name: 'FICA (Social Security & Medicare)', employerName: 'FICA (employers)', employee: { from: 0, to: 184500, rate: 0.0765, above: 0.0145 }, employer: { from: 0, rate: 0.0765 } },
      stateBands: [[26050, 0], [Infinity, 0.0275]], stateName: 'Ohio income tax',
      localIncome: 0.02, localName: 'city income tax',
      companyBands: [[Infinity, 0.21]],
      companyRefRate: 0.21,
      largeCompanyRevenue: Infinity,
      salesTax: {
        st725: { food: [0, 0.02, 0.01, 0.068], transport: [0, 0.06, 0.06, 0.068], leisure: [0, 0.04, 0.05, 0.068], child: 0.01, other: 0.05 },
        st825: { food: [0, 0.023, 0.012, 0.076], transport: [0, 0.068, 0.068, 0.076], leisure: [0, 0.045, 0.057, 0.076], child: 0.012, other: 0.057 },
      },
      salesTaxNames: { st725: 'sales tax', st825: 'sales tax' },
      salesTaxRaise: 'st825',
      priceBase: { salesTax: 'st725', fuel: 'none' },
      assessment: 0.15, assessmentName: 'property tax',
      employerCorp: 0.05,
      eis: 0,
      federalShare: { 'company tax (town firms)': 0.7, 'dividend tax': 0.5 },
      fuel: { none: { px: 1, cost: 0 }, targeted: { px: 0.97, cost: 0.03 }, blanket: { px: 0.94, cost: 0.06 } },
      dividend: { above: 49450, rate: 0.15 },
      zakatRebate: false,
      estateAllowance: 15000000,
      // Refundable credits with the tax return: EITC by number of children (2026: max $664 / $4,427 /
      // $7,316 / $8,231), Child Tax Credit $2,200 per child under 17 ($1,700 refundable).
      credits: {
        eitc: [
          { max: 664, inRate: 0.0765, outFrom: 10860, outRate: 0.0765 },
          { max: 4427, inRate: 0.34, outFrom: 23890, outRate: 0.1598 },
          { max: 7316, inRate: 0.4, outFrom: 23890, outRate: 0.2106 },
          { max: 8231, inRate: 0.45, outFrom: 23890, outRate: 0.2106 },
        ],
        marriedExtra: 7110,
        ctc: { amount: 2200, refundable: 1700, phaseFrom: 200000, under: 17 },
      },
    },
    // The Fed held the federal funds rate at 3.75-4.00% in October 2026.
    bank: { policyRate: 0.0388, floor: 0.0025, ceiling: 0.06 },
    // 401(k): voluntary (about 55% of workers save), 6% from the worker, a 3% employer match, open from 59 1/2.
    retirement: { employee: 0.06, employer: 0.03, participation: 0.55, accessAge: 59.5, dividend: { growth: 0.09, normal: 0.06, recession: 0 } },
    fund: { payout: 0.04 },
    gov: {
      laws: [
        { key: 'incomeTax', name: 'Income tax', def: 'normal', options: [['low', 'Low (brackets x0.6)'], ['normal', 'Federal brackets (10-37%)'], ['high', 'High (brackets x1.5)']], econ: { low: 1, normal: 0, high: -1 } },
        { key: 'corpTax', name: 'Corporate tax', def: '21', options: [['15', '15%'], ['21', '21% (US)'], ['28', '28%']], econ: { '15': 0.8, '21': 0, '28': -0.8 } },
        { key: 'minWage', name: 'Minimum wage', def: '1906', options: [['1257', '$7.25 an hour (federal)'], ['1906', '$11.00 an hour (Ohio 2026)'], ['2600', '$15 an hour']], econ: { '1257': 0.8, '1906': 0, '2600': -0.9 } },
        { key: 'cashAid', name: 'City cash assistance', def: '0', options: [['0', 'None'], ['200', '$200/month'], ['400', '$400/month']], econ: { '0': 0, '200': -0.5, '400': -0.9 } },
        { key: 'ubi', name: 'Universal basic income', def: '0', options: [['0', 'None'], ['1000', '$1,000/month for every adult']], econ: { '0': 0.3, '1000': -1.3 } },
        { key: 'estateTax', name: 'Estate tax', def: '0.4', options: [['0', 'None'], ['0.4', '40% above $15M (federal)']], econ: { '0': 0.6, '0.4': 0 } },
        { key: 'police', name: 'Police force', def: '2.3', options: [['1.6', '1.6 officers per 1,000'], ['2.3', '2.3 per 1,000 (US)'], ['3.5', '3.5 per 1,000']], soc: { '1.6': 0.5, '2.3': 0, '3.5': -0.8 }, econ: { '1.6': 0.3, '2.3': 0, '3.5': -0.3 } },
        { key: 'drugPolicy', name: 'Drug policy', def: 'national', options: [['national', 'Arrest and prosecute, with drug courts'], ['punitive', 'Punitive (prison)'], ['treatment', 'Treatment first'], ['decriminalised', 'Decriminalized use']], soc: { national: -0.3, punitive: -1, treatment: 0.5, decriminalised: 1 } },
        { key: 'uniFees', name: 'College tuition', def: 'subsidised', options: [['free', 'Tuition-free public college'], ['subsidised', 'In-state public tuition (~$11,600/yr)'], ['expensive', 'Private-college prices (x2.5)']], econ: { free: -0.8, subsidised: 0, expensive: 0.8 } },
        { key: 'recordCheck', name: 'Criminal record checks in hiring', def: 'allowed', options: [['allowed', 'Allowed (background checks)'], ['banned', 'Banned (ban the box)']], soc: { allowed: -0.3, banned: 0.7 } },
        { key: 'affirm', name: 'Affirmative action in hiring', def: 'none', options: [['none', 'None (race-neutral)'], ['need', 'Need-based (low income)'], ['group', 'Race-conscious preference']], econ: { none: 0, need: -0.4, group: -0.2 }, soc: { none: 0, need: 0.2, group: 0.4 } },
        { key: 'barBan', name: 'Bars and alcohol', def: 'open', options: [['open', 'Allowed (taxed)'], ['ban', 'Dry town (banned)']], soc: { open: 0.3, ban: -0.6 } },
        { key: 'fuelSubsidy', name: 'Gas tax', def: 'none', options: [['none', 'Gas taxes as now (federal + Ohio)'], ['targeted', 'Gas tax rebate for low incomes'], ['blanket', 'Gas tax holiday for everyone']], econ: { none: 0, targeted: -0.3, blanket: -0.6 } },
        { key: 'salesTax', name: 'Sales tax', def: 'st725', options: [['st725', '7.25% (groceries exempt)'], ['st825', '8.25%']], econ: { st725: 0.2, st825: -0.3 } },
        { key: 'schools', name: 'Public schools', def: 'national', options: [['lean', '7.5 teachers per 1,000'], ['national', '9.4 per 1,000 (US)'], ['generous', '11.5 per 1,000']], econ: { lean: 0.5, national: 0, generous: -0.5 } },
        { key: 'health', name: 'County hospital and clinics', def: 'national', options: [['lean', 'Lean (6 nurses, 2 doctors per 1,000)'], ['national', 'US county system (8 nurses, 2.6 doctors)'], ['generous', 'Generous (10 nurses, 3.2 doctors)']], econ: { lean: 0.5, national: 0, generous: -0.5 } },
      ],
      leaderTitles: { president: 'Council President', mayor: 'Mayor', datuk: 'City Manager' },
      leaderPay: { share: 0.02, min: 4000, max: 15000 },
      policePer1000: 2.3,
      servicePay: { teacher: 7800, nurse: 9500, doctor: 24000 }, // pay + benefits
      council: {
        treasurer: { title: 'Finance Director', en: 'City Finance Director', does: 'Collects taxes and splits the budget. A weak or corrupt director loses revenue to evasion and development money to waste.' },
        police: { title: 'Chief of Police', en: 'Police Chief', does: 'Leads the police: how many cases get solved and how hard gangs are pushed.' },
        community: { title: 'Director of Community Services', en: 'Community Services', does: 'Runs city cash assistance, job-loss help and training places for people out of work.' },
      },
      trainCost: 700,
      officialGroups: ['white', 'hispanic', 'black', 'asian'],
      preferredGroups: ['black', 'hispanic'],
      austerity: [['ubi', { 1000: '0' }], ['cashAid', { 400: '200', 200: '0' }], ['salesTax', { st725: 'st825' }, 0.5], ['incomeTax', { low: 'normal', normal: 'high' }]],
      emergency: { aid: ['cashAid', { 0: '200' }], police: ['police', { 1.6: '2.3', 2.3: '3.5' }] },
      surplus: {
        cuts: [['incomeTax', { high: 'normal', normal: 'low' }], ['salesTax', { st825: 'st725' }], ['corpTax', { 28: '21', 21: '15' }]],
        spends: [['health', { lean: 'national', national: 'generous' }], ['schools', { lean: 'national', national: 'generous' }], ['cashAid', { 0: '200', 200: '400' }], ['fuelSubsidy', { none: 'targeted' }]],
      },
    },
    services: {
      schools: { lean: 7.5, national: 9.4, generous: 11.5 },
      health: { lean: [6, 2], national: [8, 2.6], generous: [10, 3.2] },
      charges: { minor: 1, share: 0.05 }, // (US bills go through the health insurance rules below)
    },
    // Health cover (KFF 2025, CMS 2026): employer plans (worker pays ~$120 a month alone, ~$570 for a family;
    // deductible ~$1,900), marketplace plans (~$620 a month at 40, capped at 9.96% of income below 400% of the
    // poverty line), Medicare from 65 (Part B $202.90), Medicaid below 138% of the poverty line (children to
    // 206%), the uninsured pay a discounted price. US prices for care are ~2.2x the engine's.
    health: {
      priceMult: 2.2, selfPay: 0.6,
      fpl: { base: 15960, perPerson: 5680 }, medicaidFpl: 1.38, childFpl: 2.06, subsidyFpl: 4, subsidyCap: 0.0996,
      offerRate: 0.8, buyRate: 0.85,
      plans: {
        employer: { premium: 120, familyPremium: 570, deductible: 1900, coins: 0.2, oopMax: 5000 },
        market: { premium: 620, deductible: 5000, coins: 0.3, oopMax: 10150 },
        medicare: { premium: 203, deductible: 1700, coins: 0.2, oopMax: 7000 },
        medicaid: { premium: 0, deductible: 0, coins: 0.02, oopMax: 200 },
      },
    },
    // Welfare (2026): Social Security from 67 (62 with 30% less), SNAP (max $298 for one, +$232 per person;
    // 30% of net income counts; adults without children who do not work get 3 months), TANF (Ohio Works
    // First ~$560 for a family, 36 months), unemployment insurance (~50% of pay up to ~$2,700 a month, 26 weeks).
    welfare: {
      model: 'usa',
      jobLoss: { share: 0.5, cap: 2700, days: 182 },
      socialSecurity: { age: 67, early: 62, earlyFactor: 0.7, bends: [1286, 7749], rates: [0.9, 0.32, 0.15], cap: 184500, max: 5100, typical: 4500 },
      snap: { max: 298, perPerson: 232, grossFpl: 1.3, assets: 3000, stdDeduction: 209, earnedDeduction: 0.2, benefitRate: 0.3, ablebodiedMonths: 3, takeUp: 0.82 },
      tanf: { amount: 560, months: 36 },
    },
    // Federal student loans: borrowed when a student cannot pay, a 10-year plan at ~6.4%, not cleared by
    // bankruptcy; Pell grants up to $7,395 a year for low-income students.
    // C06 (approximate, from Census ACS 2023 attainment by age and NCES entry rates; not official targets):
    // founders' bachelor's-or-higher and associate-degree shares by age group; yearly entry places per age cohort.
    education: { founders: [[25, 0.2, 0.05], [35, 0.4, 0.1], [45, 0.4, 0.11], [55, 0.35, 0.11], [65, 0.33, 0.1], [200, 0.3, 0.08]], places: { bach: 0.45, master: 0.1, voc: 0.25 }, admitBar: 0, vocIsced: 5, loans: { model: 'fixed', years: 10, interest: 0.064 }, pell: { max: 7395, incomeLimit: 60000 } }, // vocIsced: an associate degree is ISCED 5 (C02)
    settings: {
      preset: { options: { national: "Today's rules (calibrated to US data)" }, help: "Fills the settings below. US: ~1.6 children per woman, ~79-year life expectancy, Ohio's state rules." },
      founders: { help: 'Strangers who found the town. The map size follows (100 = a small village).' },
      inflMin: { help: 'US CPI: 2015 averaged 0.1%.' },
      inflMax: { help: 'US CPI: the 2010s ranged 0.1-3.2%; 2022 averaged 8.0%.' },
      fertility: { options: { national: 'US today (~1.6 children per woman)' } },
      mortMult: { help: '1 = original engine (~80-year lives), 1.05 = US (79 years). 0 = nobody dies of old age.' },
      society: { options: { on: 'On (income class, religion, festivals)' } },
      ethnicMix: { options: { national: 'US 2024 (White, Hispanic, Black, Asian, other)' } },
      interfaith: { options: { national: 'Free choice (US law)' } },
      drugPolicy: { options: { national: 'US mix (arrest and prosecute, drug courts)' } },
    },
    society: {
      religions: {
        islam: { name: 'Islam', icon: '☪️', colour: '#2a9d8f', place: 'masjid', day: 4, slot: 0, mean: 62, fund: 'Zakat fund', festival: 'raya', worship: 'Prayers at the Islamic center' },
        buddhism: { name: 'Buddhism', icon: '☸️', colour: '#f4a261', place: 'tokong', day: -1, slot: 1, mean: 40, fund: 'Temple fund', festival: null, worship: 'Temple visit' },
        christianity: { name: 'Christianity', icon: '✝️', colour: '#5aa9e6', place: 'gereja', day: 6, slot: 0, mean: 52, fund: 'Church food pantry', festival: 'christmas', worship: 'Sunday service' },
        hinduism: { name: 'Hinduism', icon: '🕉️', colour: '#e76f51', place: 'kuil', day: -1, slot: 1, mean: 55, fund: 'Temple welfare fund', festival: 'deepavali', worship: 'Prayers at the temple' },
        other: { name: 'Other (Jewish, other)', icon: '✡️', colour: '#b892ff', place: 'hall', day: 5, slot: 0, mean: 45, fund: 'Community fund', festival: null, worship: 'Sabbath service' },
        none: { name: 'No religion', icon: '○', colour: '#9aa5b1', place: null, mean: 6 },
      },
      // Pew Religious Landscape Study 2023-24: Christian ~62%, unaffiliated ~29%, Jewish 2%, Muslim, Hindu, Buddhist ~1% each.
      relByEth: {
        white: { christianity: 0.64, none: 0.31, other: 0.04, buddhism: 0.005, islam: 0.005 },
        hispanic: { christianity: 0.71, none: 0.26, other: 0.02, islam: 0.005, buddhism: 0.005 },
        black: { christianity: 0.72, none: 0.21, islam: 0.04, other: 0.03 },
        asian: { christianity: 0.34, none: 0.32, hinduism: 0.15, buddhism: 0.11, islam: 0.06, other: 0.02 },
        other: { christianity: 0.5, none: 0.38, islam: 0.04, other: 0.05, buddhism: 0.03 },
      },
      celebrates: { christmas: { all: true }, thanksgiving: { all: true }, easter: { rel: 'christianity' }, raya: { rel: 'islam' }, deepavali: { rel: 'hinduism' }, cny: { eth: 'asian' } },
      classNames: { B40: 'Lower income · bottom 40%', M40: 'Middle income · middle 40%', T20: 'Higher income · top 20%' },
      classShort: { B40: 'Bottom 40%', M40: 'Middle 40%', T20: 'Top 20%' },
      statsOffice: 'Census', cutsYear: 2024,
      // Household income per month at the 40th and 80th percentiles (Census 2024: ~$63k and ~$165k a year), poverty line ~$1,300 for one.
      bottom40Max: 5250, top20Min: 13750, hardship: 1300,
      nisab: 9000,
      nonShariah: ['PSTB', 'WRNH'],
      lawReligion: null,
    },
    calendar: {
      festivals: [
        { id: 'newyear', name: "New Year's Day", doy: 0, span: 2 },
        { id: 'cny', name: 'Lunar New Year', doy: 40, span: 2, lunar: true },
        { id: 'raya', name: 'Eid al-Fitr', doy: 100, span: 2, lunar: true },
        { id: 'easter', name: 'Easter', doy: 95, span: 2 },
        { id: 'july4', name: 'Independence Day', doy: 184, span: 1 },
        { id: 'halloween', name: 'Halloween', doy: 303, span: 1 },
        { id: 'deepavali', name: 'Diwali', doy: 300, span: 2, lunar: true },
        { id: 'thanksgiving', name: 'Thanksgiving', doy: 328, span: 2 },
        { id: 'christmas', name: 'Christmas', doy: 357, span: 3 },
      ],
      fast: { before: 'raya', days: 30 },
    },
    art: {
      style: 'us',
      latitude: 40, summerTime: [67, 305], // daylight saving time
      seasons: true,
      weather: { rain: [0.4, 0.36, 0.42, 0.42, 0.42, 0.38, 0.35, 0.32, 0.3, 0.32, 0.38, 0.4], heavy: 0.12, snow: { months: [0, 1, 11], chance: 0.14, spells: [3, 5], days: [1, 3], lying: 4 } },
      hazeSky: { id: 'heat', name: 'Heat wave' },
      outfits: [['raya', { rel: 'islam' }, 'kurta', 'kurung'], ['deepavali', { rel: 'hinduism' }, 'kurta', 'saree'], ['christmas', { rel: 'christianity' }, 'office', 'office'], ['easter', { rel: 'christianity' }, 'office', 'office'], ['thanksgiving', {}, 'office', 'office'], ['cny', { eth: 'asian' }, 'cny', 'cny']],
      decor: { christmas: 'mallTree', july4: 'flags', halloween: 'pumpkins', raya: 'homeLights', deepavali: 'diyas', cny: 'lanterns' },
      flag: { stripes: ['#ffffff', '#b22234'], canton: '#3c3b6e', star: '#ffffff' },
      fireworks: ['newyear', 'july4'],
      festivalTracks: ['christmas', 'cny', 'deepavali'],
    },
    gangNames: { pattern: '{a} {b}', a: ['Northside', 'Eastside', 'West End', 'Southside', 'Riverside', 'Hilltop', 'Iron', 'Red'], b: ['Crew', 'Kings', 'Boys', 'Mob', 'Syndicate', 'Posse'] },
    // TFR ~1.6 (CDC 2024); life expectancy ~79 (CDC 2024).
    // Share of job openings that go to someone from outside town (Phase 6: sets unemployment).
    labour: { outsideHire: 0.45, paySd: 0.55, market: 1.6 }, // market: US firms reach bigger markets (more large firms, more top incomes) // US pay is more spread out (BLS: P90/P10 ~5 against ~3.5 in the UK)
    demography: { fertMult: 0.75, mortMult: 1.05 }, // Phase 6 markets: TFR 1.28 at 0.6, life expectancy 77.4 at 1.2; // 80-year runs: TFR 1.10 at 0.42 (US child costs are high) and life expectancy 77.1 at 1.3
    typicalTop: 50000000, // about the richest fortune of a 300-founder town after 40 years under rules revision 9 (single towns ranged $36M-$242M) (Year-1 money; two test seeds, Nov 2026): the setup hint
    defaults: { goalRM: 200000000, marketOutsideRM: 350000000, mortMult: 1.05, leaderTitle: 'mayor', termYears: 4, inflMin: 0, inflMax: 6 },
    // Crime per 100k a year for the offences the engine models (FBI 2025): burglary ~160, vehicle theft ~147,
    // robbery ~50, aggravated assault ~210, murder 4.1, theft from the person ~15. Prisons and jails ~1.85m
    // (~540 per 100k). Problem drug users (opioids, stimulants) ~900 per 100k (approximate).
    crime: { index: 590, violent: 265, property: 325, murder: 4.1, users: 900, prison: 540 },
    // Tuned (2 seeds x 20 years at the Realistic scale: index ~410-450, ~30% solved, ~545 prisoners per 100k):
    // more chances to offend than Malaysia, police solve about half as often, few community sentences and
    // long ones (plea deals, mandatory minimums), prison from the second possession arrest, and guns make
    // fights and robberies four times as deadly.
    crimeTuning: { opportunity: 1.75, clear: 0.5, community: 0.15, drugRepeat: 1, sentence: 1.2, lethal: 4, drugUse: 1.6 }, // (Phase 6: 805 prisoners and 426 users at sentence 2, drugUse 1)
    crimeTuningRev8: { opportunity: 0.6 }, // Rules revision 8 (Nov 2026): with police case capacity measured against this country's own crime level, index crime lands near 590 per 100k (was ~2,600).
    events: {
      flood: { doy: 95, chance: 0.2, relief: 750, name: 'Spring floods' },
      haze: { doy: 200, chance: 0.3, days: 10, name: 'Heat wave', text: 'Heat wave: the hot weeks are hard on the old and the very young' },
      tornado: { doy: 130, chance: 0.12, damage: [3000, 40000], name: 'Tornado' },
    },
    calibration: {
      tertiary: { target: 0.51, band: 0.1, src: 'OECD Education at a Glance 2024: 51% of 25-64 year-olds (associate degree or higher)' },
      tfr: { target: 1.6, band: 0.35, src: 'CDC NCHS births 2024 (TFR 1.6)' },
      e0: { target: 79, band: 3, src: 'CDC NCHS mortality 2024 (79.0)' },
      unemp: { target: 0.043, band: 0.015, src: 'BLS Current Population Survey, 2026 (~4.3%)' },
      medWage: { target: 5420, band: 1000, src: 'BLS usual weekly earnings, Q2 2026, full-time ($1,251 a week)' },
      hhGini: { target: 0.48, band: 0.06, src: 'Census Bureau, household money income 2024 (Gini ~0.48)' },
      starve: { target: 0, band: 0.01, src: 'No deaths from hunger' },
      crimeIdx: { target: 590, band: 240, src: 'FBI Crime in the Nation 2025, modelled offences' },
      drugUsers: { target: 900, band: 400, src: 'Problem drug users (opioids, stimulants), approximate' },
      prison: { target: 540, band: 200, src: 'BJS: ~1.85m in prisons and jails' },
      clearance: { target: 0.25, band: 0.1, src: 'FBI clearance rates (violent ~40%, property ~13%), weighted for these offences' },
      revenue: { target: 2000, band: 600, src: 'Federal (~$5.2tn) + state and local (~$3tn) revenue / 342m people' },
    },
    notes: {
      revenue: 'US ~$2,000 incl. federal, state and local',
      events: 'Spring rains flood riverside homes and tornadoes tear through a few blocks; FEMA pays $750 to each household hit. Summer heat waves hurt health, most of all for the old and very young.',
      laws: 'Each law is a real lever in the engine: tax rates, the minimum wage on every job, city cash assistance and basic income paid each month, how many police officers, teachers, nurses and doctors the city employs, how drug users are treated, college tuition, whether employers may check records, affirmative action, whether the town is dry, the gas tax and the sales tax.',
      taxes: 'Taxes follow the US and Ohio: federal income tax (10-37% above the $16,100 standard deduction), FICA (7.65% from workers and employers), Ohio income tax (2.75% above $26,050), a 2% city income tax, 7.25% sales tax with groceries exempt, property tax through rents, 21% corporate tax and the federal estate tax above $15M. Low earners get the EITC and the Child Tax Credit back with their tax return.',
      bank: 'The Fed sets the federal funds rate (3.75-4.00% in late 2026); the town economy moves it between 0.25% and 6%.',
      council: 'Leaders who care less about merit may appoint friends over abler people. The FBI can catch officials who take kickbacks or bribes.',
      glcLater: 'There are no government-linked companies; the city keeps its surplus in a rainy-day fund.',
    },
  });
})(globalThis.LES = globalThis.LES || {});
