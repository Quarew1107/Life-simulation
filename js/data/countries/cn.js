// China country pack: a fictional mid-sized city in central China (Hubei/Hunan style) with national
// rules and statistics. Money is in Year-1 yuan (real money); money.scale tells the engine yuan are
// ~2.3x the size of its ringgit-sized units (World Bank ICP price levels: ~3.6 yuan and ~1.55 ringgit to
// the international dollar). Town and company names are invented (pinyin names may match small townships).
// Sources: NBS Statistical Communique 2024 (disposable income ¥41,314; urban ¥54,188, rural ¥23,119, ratio
// 2.34; life expectancy 79.0; surveyed urban unemployment 5.1%; urban private-unit average wage ¥69,476),
// IIT Law (2019 bands, ¥60,000 a year standard deduction, ¥2,000 a month per child from 2023), State
// Council 2024 decision on the retirement age (from 2025), MOHRSS social insurance rules, NHSA medical
// insurance statistics 2024, the 2025 childcare subsidy (¥3,600 a year under 3), MCA dibao standards 2024,
// China Drug Situation Report 2023, World Prison Brief, UN WPP 2024, Ministry of Finance 2024 final accounts.
(function (LES) {
  'use strict';
  const TOWN = 'Qiaoyun';
  const X = v => Math.round(v / 1.75 * 2.3 / 100) * 100; // business sizes: the US pack's, in yuan
  const biz = (name, capital, scale0, cap, fixed, names, fee) => Object.assign({ name, capital: X(capital), scale0: X(scale0), cap: X(cap), fixed: X(fixed), names }, fee ? { fee } : {});
  LES.Countries.register({
    code: 'cn',
    name: 'China',
    adj: 'Chinese',
    money: { symbol: '¥', code: 'CNY', name: 'yuan', scale: 2.3 },
    content: {
      townName: TOWN,
      castDefault: { first: 'Mei', last: 'Wang', eth: 'han', skin: '#f1c27d' },
      // 2020 census: Han 91.1%, Zhuang 1.4%, Uyghur 0.8%, Hui 0.8%, Manchu 0.7%, other minorities 5.2%.
      ethnicities: ['han', 'zhuang', 'hui', 'manchu', 'uyghur', 'other'],
      ethnicNames: { han: 'Han', zhuang: 'Zhuang', hui: 'Hui', manchu: 'Manchu', uyghur: 'Uyghur', other: 'Other minorities' },
      ethnicMixes: {
        national: { keys: ['han', 'zhuang', 'hui', 'manchu', 'uyghur', 'other'], w: [0.911, 0.014, 0.008, 0.007, 0.008, 0.052] },
        classic: { keys: ['han', 'zhuang', 'hui', 'manchu', 'uyghur', 'other'], w: [0.911, 0.014, 0.008, 0.007, 0.008, 0.052] }, // Classic rules are Malaysia only
      },
      surnameFirst: ['han', 'zhuang', 'hui', 'manchu', 'other'], // Chinese order: Wang Mei
      names: {
        han: {
          M: ['Wei', 'Hao', 'Jun', 'Lei', 'Yang', 'Jie', 'Tao', 'Ming', 'Qiang', 'Bo', 'Haoran', 'Zihan', 'Yuxuan', 'Jianguo', 'Zhiwei', 'Chen'],
          F: ['Fang', 'Jing', 'Li', 'Min', 'Yan', 'Xiu', 'Na', 'Ting', 'Xin', 'Yuting', 'Zihan', 'Shuang', 'Lina', 'Mei', 'Xiaoyu', 'Yifan'],
          last: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou', 'Xu', 'Sun', 'Hu', 'Zhu', 'Gao', 'Lin', 'He', 'Guo'],
        },
        zhuang: {
          M: ['Wei', 'Qiang', 'Hai', 'Jun', 'Feng', 'Liang', 'Bin', 'Gang'],
          F: ['Lan', 'Hong', 'Ying', 'Fang', 'Juan', 'Yan', 'Qin', 'Mei'],
          last: ['Wei', 'Huang', 'Lu', 'Mo', 'Nong', 'Lan', 'Liang', 'Qin'],
        },
        hui: {
          M: ['Jianhua', 'Xiaolong', 'Yusuf', 'Ming', 'Hai', 'Wei', 'Jun', 'Zhong'],
          F: ['Fatima', 'Lan', 'Jing', 'Hua', 'Yan', 'Xue', 'Min', 'Li'],
          last: ['Ma', 'Hui', 'Bai', 'Ha', 'Hai', 'Na', 'Mu', 'Sa'],
        },
        manchu: {
          M: ['Guang', 'De', 'Rui', 'Hao', 'Kai', 'Peng', 'Xin', 'Long'],
          F: ['Yu', 'Ling', 'Qi', 'Rong', 'Xue', 'Wen', 'Hui', 'Lu'],
          last: ['Guan', 'Tong', 'Zhao', 'Na', 'Fu', 'Jin', 'Lang', 'Suo'],
        },
        uyghur: {
          M: ['Abdulla', 'Mehmet', 'Ablimit', 'Ekber', 'Tursun', 'Adil', 'Ilham', 'Yasin'],
          F: ['Ayshem', 'Gulnar', 'Mihray', 'Nurgul', 'Patime', 'Reyhan', 'Zohre', 'Dilnur'],
          last: ['Tursun', 'Abdukerim', 'Memet', 'Rozi', 'Niyaz', 'Hesen', 'Qadir', 'Osman'],
        },
        other: {
          M: ['Gang', 'Dawa', 'Ayi', 'Long', 'Shan', 'Yong', 'Hu', 'Sen'],
          F: ['Lamu', 'Mei', 'Duo', 'Xian', 'Hua', 'Yun', 'Lian', 'Jiao'],
          last: ['Yang', 'Long', 'Shi', 'Tian', 'Ma', 'Wu', 'Zhaxi', 'Ji'],
        },
      },
      // Rules revision 7 (Nov 2026): more first and family names (added to `names` in new worlds only, so older
      // worlds and saves keep exactly the names they had). Drawn from each country's naming registers and trends.
      namesMore: {
        han: {
          M: ["Yichen", "Haoyu", "Zixuan", "Muchen", "Yuchen", "Hanyu", "Junjie", "Zihao", "Yuhang", "Haoxuan", "Zhiqiang", "Jianjun", "Guoqiang", "Jianhua", "Xiaoming", "Xiaojun", "Dawei", "Weidong", "Hongwei", "Jianping", "Yong", "Peng", "Kai", "Feng", "Lin", "Bin", "Chao", "Xiang", "Zhen", "Ruixuan", "Ze", "Yuze", "Chenxi", "Siyuan", "Jiahao", "Mingze"],
          F: ["Yinuo", "Xiyue", "Shihan", "Muyan", "Ruoxi", "Xinyi", "Yuxi", "Yiyi", "Zixin", "Kexin", "Yutong", "Siqi", "Mengyao", "Jiayi", "Shiyu", "Yuhan", "Xiuying", "Guiying", "Yulan", "Lijuan", "Hong", "Yan", "Xiaohong", "Xiaoli", "Jing", "Wenjing", "Qian", "Lu", "Dan", "Hui", "Ying", "Ruolan", "Yiran", "Anqi", "Mengqi", "Xinyue"],
          last: ["Ma", "Luo", "Liang", "Song", "Zheng", "Xie", "Han", "Tang", "Feng", "Yu", "Dong", "Xiao", "Cheng", "Cao", "Yuan", "Deng", "Xu", "Fu", "Shen", "Zeng", "Peng", "Lü", "Su", "Lu", "Jiang", "Cai", "Jia", "Ding", "Wei", "Pan", "Du", "Dai", "Xia", "Zhong", "Wang"],
        },
        zhuang: {
          M: ["Shengli", "Hailong", "Wenbin", "Jiahua", "Guohua", "Liming", "Yongjun", "Hongbo", "Zhiyuan", "Jinlong", "Haitao", "Chengzhi"],
          F: ["Meilan", "Xiaoyan", "Liuhua", "Yuhong", "Chunmei", "Lifang", "Xiulan", "Yanling", "Huifang", "Shuling", "Guilan", "Hongmei"],
          last: ["Li", "Wang", "Zhou", "Tan", "Ban", "Lan", "Long", "Meng", "Luo", "Tang"],
        },
        hui: {
          M: ["Yousuo", "Musa", "Ibrahim", "Haiping", "Dexin", "Jianguo", "Zhiping", "Xiaowei", "Junliang", "Ali", "Yongfu", "Shaohua"],
          F: ["Aisha", "Maryam", "Haiyan", "Xiumei", "Lanying", "Fengying", "Yuehua", "Xiaojuan", "Lili", "Zainab", "Huimin", "Qinglan"],
          last: ["Ma", "Yang", "Li", "Han", "Ding", "Mu", "Hu", "Ha", "Ke", "Lan"],
        },
        manchu: {
          M: ["Jinming", "Delong", "Zhenyu", "Yuxiang", "Fuchun", "Ruiqi", "Shuyuan", "Guangyu", "Dehai", "Tianyi", "Yixuan", "Wenhao"],
          F: ["Yuqing", "Shuhua", "Lingyun", "Ruixue", "Wanrong", "Xiaoxue", "Mingyue", "Jiaqi", "Yifei", "Qiuyue", "Huiru", "Yanhong"],
          last: ["Aisin-Gioro", "Wang", "Liu", "Bai", "He", "Ha", "Tan"],
        },
        uyghur: {
          M: ["Erkin", "Alim", "Kerem", "Nurmemet", "Obul", "Polat", "Rahman", "Sadir", "Tahir", "Ubul", "Yusup", "Zunun", "Mahmut", "Ehmet"],
          F: ["Aynur", "Buhelchem", "Gulzar", "Hanzohra", "Meryem", "Muyesser", "Nigare", "Parida", "Rabiye", "Saadet", "Tajigul", "Zulfiye", "Ayse", "Gulbahar"],
          last: ["Abdulla", "Ablimit", "Mamut", "Yasin", "Ismayil", "Turdi", "Abliz", "Kurban", "Sadiq", "Hoshur"],
        },
        other: {
          M: ["Tashi", "Norbu", "Dorje", "Bater", "Bayar", "Chaolu", "Sonam", "Jinpa", "Ayi", "Wuyun", "Tenzin", "Aodeng", "Jiagu"],
          F: ["Dolma", "Yangzom", "Pema", "Tsering", "Saran", "Narin", "Uyuna", "Gerile", "Ashima", "Aqi", "Lhamo", "Sarula", "Meizi", "Ruona"],
          last: ["Bao", "Han", "Tong", "Ou", "Teng", "Qi", "Ba", "Dawa", "Wu", "Pu"],
        },
      },
      skin: {
        han: ['#f1c27d', '#eac086', '#e0ac69'],
        zhuang: ['#e0ac69', '#d29a5e', '#eac086'],
        hui: ['#eac086', '#e0ac69', '#f1c27d'],
        manchu: ['#f1c27d', '#f3cfa0', '#eac086'],
        uyghur: ['#e8b98a', '#d8a47a', '#f0c8a0'],
        other: ['#d29a5e', '#c68642', '#e0ac69'],
      },
      // Fees: public universities ~¥5,000-6,000 a year; higher vocational colleges ~¥5,000.
      quals: { VOC: 'Vocational Diploma (dazhuan)', BACH_GEN: 'Bachelor of Arts', BACH_BUS: 'Bachelor of Management', BACH_ENG: 'Bachelor of Engineering', MED: 'Bachelor of Medicine', MASTER: "Master's Degree", BACH_SCI: 'Bachelor of Science', BACH_CS: 'Bachelor of Computer Science', BACH_ARCH: 'Bachelor of Architecture (5 years)', BACH_LAW: 'Bachelor of Laws', BACH_PHARM: 'Bachelor of Pharmacy', BACH_SOC: 'Bachelor of Social Work' },
      courses: {
        VOC: { name: 'Higher vocational college (3 years)', fee: 15000, months: 36 },
        BACH_GEN: { name: 'Bachelor of Arts', fee: 20000, months: 48 },
        BACH_BUS: { name: 'Bachelor of Management', fee: 22000, months: 48 },
        BACH_ENG: { name: 'Bachelor of Engineering', fee: 22000, months: 48 },
        MED: { name: 'Bachelor of Medicine (5 years)', fee: 30000, months: 60 },
        MASTER: { name: "Master's Degree", fee: 24000, months: 36 },
        BACH_SCI: { name: 'Bachelor of Science', fee: 21000, months: 48 },
        BACH_CS: { name: 'Bachelor of Computer Science', fee: 22000, months: 48 },
        BACH_ARCH: { name: 'Bachelor of Architecture (5 years)', fee: 26000, months: 60 },
        BACH_LAW: { name: 'Bachelor of Laws', fee: 22000, months: 48 },
        BACH_PHARM: { name: 'Bachelor of Pharmacy', fee: 24000, months: 48 },
        BACH_SOC: { name: 'Bachelor of Social Work', fee: 20000, months: 48 },
      },
      // Jobs: monthly pay in Year-1 yuan in a central-China city (NBS 2024 wages by sector, rounded).
      jobs: {
        cleaner: { title: 'Cleaner', salary: 2800, freq: 10 },
        retail: { title: 'Shop Assistant', salary: 3500, freq: 10 },
        rider: { title: 'Delivery Rider', salary: 5500, freq: 9 },
        factory: { title: 'Factory Worker', salary: 4800, freq: 11 },
        construction: { title: 'Construction Worker', salary: 6000, freq: 8 },
        sales: { title: 'Sales Representative', salary: 6000, freq: 6 },
        chef: { title: 'Cook', salary: 4800, freq: 5 },
        mechanic: { title: 'Auto Mechanic', salary: 5500, freq: 5 },
        electrician: { title: 'Electrician', salary: 6000, freq: 4 },
        nurse: { title: 'Nurse', salary: 6500, freq: 4 },
        teacher: { title: 'Teacher', salary: 6800, freq: 4 },
        accountant: { title: 'Accountant', salary: 6000, freq: 3 },
        banker: { title: 'Bank Clerk', salary: 8000, freq: 2 },
        engineer: { title: 'Engineer', salary: 9500, freq: 3 },
        softdev: { title: 'Software Engineer', salary: 13000, freq: 3 },
        manager: { title: 'Manager', salary: 12000, freq: 1.5 },
        doctor: { title: 'Doctor', salary: 13000, freq: 1.5 },
        cityretail: { title: 'City Store Manager', salary: 7000, freq: 1.5 },
        citycorp: { title: 'City Office Analyst', salary: 9000, freq: 1.5 },
        citytech: { title: 'City Software Engineer', salary: 18000, freq: 1 },
        // Expansion 1 (rules revision 5): how common each is comes from content.js, rescaled per entry level.
        waiter: { title: 'Restaurant Server', salary: 3800 },
        barista: { title: 'Barista', salary: 4000 },
        security: { title: 'Security Guard', salary: 3800 },
        warehouseop: { title: 'Warehouse Assistant', salary: 4800 },
        careasst: { title: 'Care Worker', salary: 4500 },
        plumber: { title: 'Plumber', salary: 6200 },
        carpenter: { title: 'Carpenter', salary: 6200 },
        hairdresser: { title: 'Hairdresser', salary: 5000 },
        busdriver: { title: 'Bus Driver', salary: 6200 },
        itsupport: { title: 'IT Support Technician', salary: 6500 },
        labtech: { title: 'Laboratory Technician', salary: 6000 },
        pharmacist: { title: 'Pharmacist', salary: 8500 },
        paramedic: { title: 'Paramedic', salary: 6800 },
        firefighter: { title: 'Firefighter', salary: 6500 },
        architect: { title: 'Architect', salary: 11000 },
        lawyer: { title: 'Lawyer', salary: 11000 },
        socialworker: { title: 'Social Worker', salary: 5500 },
        scientist: { title: 'Research Scientist', salary: 11000 },
        analyst: { title: 'Data Analyst', salary: 10000 },
        journalist: { title: 'Journalist', salary: 7000 },
        equiptech: { title: 'Research Equipment Technician', salary: 7000 },
        envofficer: { title: 'Environmental Monitoring Officer', salary: 6000 },
        researchcoord: { title: 'Research Project Coordinator', salary: 8500 },
      },
      govJobs: {
        police: { title: 'Police Officer', salary: 8000 },
        treasurer: { title: 'Director of the Finance Bureau', salary: 15000 },
        community: { title: 'Director of Civil Affairs', salary: 13000 },
      },
      gigs: {
        labour: { name: 'Day labour', pay: 250 },
        delivery: { name: 'Food delivery (app)', pay: 150 },
        ehailing: { name: 'Ride-hailing driver', pay: 220 },
        pasar: { name: 'Market stall helper', pay: 120 },
        tuition: { name: 'Private tutoring', pay: 200 },
        repair: { name: 'Repair job', pay: 200 },
        freelance: { name: 'Freelance coding', pay: 600 },
        promoter: { name: 'Event staff', pay: 150 },
      },
      trainings: {
        library: { name: 'Self-study at the library', cost: 0 },
        gym: { name: 'Gym workout', cost: 30 },
        sports: { name: 'Basketball & table tennis', cost: 20 },
        speaking: { name: 'Public speaking club', cost: 30 },
        running: { name: 'Running by the river', cost: 0 },
      },
      tiers: {
        food: [
          { name: 'Cook at home', cost: 900, fx: 'Cheap; slowly hurts health & energy' },
          { name: 'Canteen & takeaway', cost: 1500, fx: 'Baseline' },
          { name: 'Healthy diet', cost: 2200, fx: '+health, +energy' },
          { name: 'Banquets & fine dining', cost: 5000, fx: '+health, -stress, +prestige' },
        ],
        housing: [
          { name: 'Room in an urban village', cost: 600, fx: 'Poor sleep, more stress' },
          { name: 'Flat in an older estate', cost: 1300, fx: 'Baseline' },
          { name: 'Flat in a new estate', cost: 2000, fx: 'Better sleep' },
          { name: 'High-rise with a clubhouse', cost: 3200, fx: 'Great sleep, +prestige' },
          { name: 'Villa', cost: 7000, fx: 'Best sleep, ++prestige' },
        ],
        transport: [
          { name: 'Bus, metro & shared bikes', cost: 120, fx: 'Tiring; no vehicle gigs' },
          { name: 'Electric scooter', cost: 250, fx: 'Unlocks delivery gigs; small accident risk' },
          { name: 'Family car (EV)', cost: 1800, fx: 'Unlocks ride-hailing' },
          { name: 'Luxury car', cost: 4500, fx: '+prestige' },
        ],
        leisure: [
          { name: 'None', cost: 0, fx: 'Stress builds up' },
          { name: 'Phone, video apps & KTV', cost: 300, fx: 'Baseline' },
          { name: 'Gym membership', cost: 400, fx: 'Keeps body fit, -stress' },
          { name: 'Private club', cost: 3000, fx: 'Networking: more business luck' },
        ],
      },
      childCost: 1200,
      childCostPerHousing: 300,
      simpleTaxBands: [[5000, 0.105], [17000, 0.2], [30000, 0.3], [Infinity, 0.4]], // IIT + social insurance, monthly
      corpTax: 0.25,
      biz: {
        stall: biz('Street Food Stall', 26000, 16000, 88000, 1050, ['Hot Dry Noodles', 'Baozi', 'Jianbing', 'Malatang', 'Skewers', 'Milk Tea']),
        workshop: biz('Repair Workshop', 70000, 31500, 440000, 2600, ['Auto Repair', 'E-bike Repair', 'Machine Works', 'Tyre Shop']),
        retail: biz('Shop', 105000, 52500, 1050000, 4400, ['Convenience Store', 'Phone Shop', 'Pharmacy', 'Fruit Shop', 'Bookshop', 'Hardware']),
        restaurant: biz('Restaurant', 262500, 122500, 5250000, 10500, ['Hotpot', 'Hubei Kitchen', 'Noodle House', 'Dumpling House', 'Barbecue']),
        trading: biz('Trading Company', 437500, 262500, 26250000, 17500, ['Trading Co.', 'Import Export', 'Holdings', 'Logistics']),
        tech: biz('Tech Startup', 210000, 26250, 52500000, 10500, ['Tech', 'Smart', 'Digital', 'AI', 'Cloud', 'Robotics']),
        property: biz('Property Developer', 1750000, 525000, 35000000, 52500, ['Real Estate', 'Development', 'Land Co.', 'Properties']),
        clinic: biz('Private Clinic', 350000, 78750, 700000, 5250, ['Dental Clinic', 'TCM Clinic', 'Eye Clinic', 'Medical Clinic']),
        privschool: biz('Private School', 2625000, 210000, 5250000, 35000, ['Foreign Language School', 'Experimental School', 'Academy', 'Bilingual School'], 3000),
        privhosp: biz('Private Hospital', 7000000, 612500, 21000000, 70000, ['Hospital', 'Medical Centre', 'Women & Children Hospital']),
      },
      depositRates: { growth: 0.015, normal: 0.012, recession: 0.008 },
      venues: {
        park: { name: 'Park', cost: 0 },
        futsal: { name: 'Basketball court', cost: 20 },
        mamak: { name: 'Noodle shop', cost: 30 },
        mall: { name: 'Mall', cost: 100 },
        cinema: { name: 'Cinema', cost: 50 },
        bowling: { name: 'Bowling', cost: 60 },
        karaoke: { name: 'KTV', cost: 100 },
        finedine: { name: 'Banquet restaurant', cost: 500 },
        spa: { name: 'Spa & foot massage', cost: 200 },
        lounge: { name: 'Rooftop bar', cost: 250 },
        golf: { name: 'Golf club', cost: 800 },
      },
      // Jade River Exchange: fictional listed companies (price in yuan, shares in millions).
      stocks: [
        { tk: 'QYBK', name: 'Qiaoyun Commercial Bank', sector: 'Finance', price0: 6, sharesM: 3000, beta: 0.8, idio: 0.12, drift: 0, colour: '#5aa9e6' },
        { tk: 'HTAG', name: 'Hetian Agriculture', sector: 'Agriculture', price0: 9, sharesM: 800, beta: 0.7, idio: 0.2, drift: 0, colour: '#57d38c' },
        { tk: 'LXTC', name: 'Linxiang Telecom', sector: 'Telco', price0: 7, sharesM: 2000, beta: 0.6, idio: 0.12, drift: 0, colour: '#b892ff' },
        { tk: 'YFSW', name: 'Yunfan Software', sector: 'Technology', price0: 38, sharesM: 600, beta: 1.6, idio: 0.4, drift: 0.02, colour: '#3ec7b5' },
        { tk: 'JDPR', name: 'Jindi Properties', sector: 'Property', price0: 5, sharesM: 2500, beta: 1.5, idio: 0.3, drift: -0.01, colour: '#f4a261' },
        { tk: 'BSRT', name: 'Baishi Retail', sector: 'Consumer', price0: 14, sharesM: 700, beta: 0.9, idio: 0.16, drift: 0, colour: '#f28482' },
        { tk: 'CJEN', name: 'Changjing New Energy', sector: 'Energy', price0: 26, sharesM: 900, beta: 1.3, idio: 0.32, drift: 0.01, colour: '#e9c46a' },
        { tk: 'HSPH', name: 'Huashan Pharma', sector: 'Healthcare', price0: 31, sharesM: 500, beta: 0.7, idio: 0.24, drift: 0.005, colour: '#ff8c42' },
      ],
      ipoPool: [
        { tk: 'TLLG', name: 'Tongliu Logistics', sector: 'Logistics', sharesM: 600, beta: 1, idio: 0.22, drift: 0, colour: '#90be6d' },
        { tk: 'XGEV', name: 'Xinguang EV', sector: 'Automotive', sharesM: 800, beta: 1.5, idio: 0.38, drift: 0.015, colour: '#ffd166' },
        { tk: 'RKBT', name: 'Ruikang Biotech', sector: 'Healthcare', sharesM: 400, beta: 0.9, idio: 0.32, drift: 0, colour: '#ef476f' },
        { tk: 'ZYCH', name: 'Zhiyun Chips', sector: 'Technology', sharesM: 700, beta: 1.6, idio: 0.42, drift: 0.02, colour: '#118ab2' },
        { tk: 'DCBD', name: 'Dacheng Builders', sector: 'Construction', sharesM: 900, beta: 1.3, idio: 0.25, drift: -0.005, colour: '#b5838d' },
        { tk: 'MXFD', name: 'Meixiang Foods', sector: 'Consumer', sharesM: 500, beta: 0.8, idio: 0.16, drift: 0, colour: '#f28482' },
        { tk: 'FTAG', name: 'Fengtian Agri', sector: 'Agriculture', sharesM: 600, beta: 0.7, idio: 0.2, drift: 0, colour: '#57cc99' },
        { tk: 'ANIN', name: 'Anxin Insurance', sector: 'Finance', sharesM: 800, beta: 0.9, idio: 0.14, drift: 0, colour: '#4361ee' },
      ],
      // State-owned companies list once the city's finances are sound (local SOEs).
      glcStocks: [
        { tk: 'QYWT', name: 'Qiaoyun Water Group', sector: 'Utilities', sharesM: 200, price0: 5, beta: 0.4, idio: 0.1, drift: 0, div: 0.035, colour: '#4cc9f0', glc: true, blurb: 'water and gas for the city' },
        { tk: 'QYUI', name: 'Qiaoyun Urban Investment', sector: 'Infrastructure', sharesM: 300, price0: 4, beta: 0.8, idio: 0.2, drift: 0, div: 0.04, colour: '#f77f00', glc: true, blurb: 'roads, metro lines and land development' },
        { tk: 'QYTR', name: 'Qiaoyun Transport', sector: 'Transport', sharesM: 150, price0: 6, beta: 0.6, idio: 0.14, drift: 0, div: 0.03, colour: '#2a9d8f', glc: true, blurb: 'buses and the metro' },
      ],
    },
    town: {
      townNames: [TOWN, 'Fengtang', 'Shuangmu'],
      buildings: {
        office: 'Qiaoyun Tower', office2: 'Commerce Centre', bank: 'Bank', bursa: 'Jade River Exchange', techhub: 'Hi-Tech Park', researchcentre: 'Research & Innovation Centre',
        mall: 'Qiaoyun Mall', mamak: 'Noodle Shop', hawker: 'Food Street', mamak2: 'Breakfast Shop', university: 'Qiaoyun University',
        kolej: 'Vocational College', library: 'City Library', hall: 'Community Centre', hospital: 'People’s Hospital', school: 'No. 1 School',
        park: 'People’s Park', gym: 'Sports Centre', factory: 'Factory', workshop: 'Repair Workshop', warehouse: 'Logistics Park', construction: 'Building Site',
        welfare: 'Children’s Welfare Home', depot: 'Bus Station', memorial: 'Memorial Garden', plaza: 'City Square', field: 'Sports Field', garden: 'Garden',
        cinema: 'Cinema', karaoke: 'Golden KTV', bowling: 'Bowling', futsal: 'Basketball Court', finedine: 'Banquet Hall', lounge: 'Rooftop Bar',
        spa: 'Foot Massage', masjid: 'Mosque', tokong: 'Buddhist Temple', kuil: 'Hindu Temple', gereja: 'Church',
        police: 'Public Security Bureau', jail: 'Detention Centre', court: 'People’s Court', prison: 'Prison', rehab: 'Drug Rehabilitation Centre',
        townhall: 'Municipal Government', padang: 'People’s Square', golf: 'Golf Club', station: 'High-Speed Rail Station', padi: 'Rice Paddies', hq: 'Tower',
        privschool: 'Private School', privhosp: 'Private Hospital',
      },
      scenery: {
        lake: ['East Lake', 'Moon Lake', 'Lotus Pond', 'Clear Water Lake'],
        hill: ['Turtle Hill', 'Phoenix Hill', 'Pine Ridge', 'Cloud Peak'],
        forest: ['Forest Park', 'Bamboo Grove', 'Camphor Woods'],
      },
      busLine: 'Line',
      signs: {
        SEWA: 'FOR RENT', // an empty shop lot waiting for a tenant
        'HAWKER CENTRE': 'FOOD STREET', 'UNIVERSITI REZEKI': 'UNIVERSITY', 'KOLEJ VOKASIONAL': 'VOCATIONAL COLLEGE', DEWAN: 'COMMUNITY CENTRE',
        BURSA: 'JADE RIVER EXCHANGE', 'REZEKI MALL': 'QIAOYUN MALL', HOSPITAL: "PEOPLE'S HOSPITAL", SEKOLAH: 'NO. 1 SCHOOL', KILANG: 'FACTORY',
        BENGKEL: 'REPAIRS', GUDANG: 'LOGISTICS', 'TAPAK BINAAN': 'BUILDING SITE', STADIUM: 'SPORTS CENTRE', 'RUMAH KEBAJIKAN': 'WELFARE HOME',
        'SAWAH PADI': 'RICE PADDIES', 'DEPOT BAS': 'BUS STATION', 'TAMAN KENANGAN': 'MEMORIAL', 'TANAH DIJUAL': 'LAND FOR SALE', TOKONG: 'TEMPLE',
        KUIL: 'HINDU TEMPLE', POLIS: 'PUBLIC SECURITY', LOKAP: 'DETENTION', 'DEWAN BANDARAYA': 'MUNICIPAL GOVT', PADANG: "PEOPLE'S SQUARE", MAHKAMAH: 'COURT',
        PENJARA: 'PRISON', PEMULIHAN: 'REHAB CENTRE', PAWAGAM: 'CINEMA', 'KARAOKE & BAR': 'KTV', FUTSAL: 'COURT',
        'RESTORAN MEWAH': 'BANQUET HALL', 'SKY LOUNGE': 'ROOFTOP BAR', 'KELAB GOLF': 'GOLF CLUB', 'STESEN KERETAPI': 'HIGH-SPEED RAIL',
        'LADANG SAWIT': 'TEA FIELDS', HUTAN: 'FOREST PARK', PPR: 'ESTATE', TAMAN: 'GARDENS', 'TAMAN TASIK': "PEOPLE'S PARK", MENARA: 'OFFICES',
      },
      mapSizeNames: { kampung: 'Village', pekan: 'Township', bandar: 'County town', bandaraya: 'City', metropolis: 'Metropolis' },
      townTypeNames: { mixed: 'Mixed city', capital: 'Business city', industrial: 'Factory city', university: 'University city', resort: 'Lake resort', farming: 'Farming county' },
      kindInfo: {
        kampung: 'An urban village: self-built houses of rented rooms, the cheapest homes in the city. Many migrants live here.',
        flat: 'An older housing estate: six- and seven-storey walk-up blocks built for work units.',
        terrace: 'A new housing estate (xiaoqu): gated mid-rise blocks with a garden and security at the gate.',
        condo: 'A high-rise estate with a clubhouse, a gym and underground parking. Upper-middle-class living.',
        bungalow: 'A villa with a garden and a garage. Home of the wealthy.',
        mamak: 'The noodle shop, open from breakfast to late. Where people meet friends, gossip and fall in love.',
        hawker: 'Food street: cheap food and delivery gigs.',
        university: 'Qiaoyun University: degrees in Arts, Management, Engineering, Medicine and Masters. Places go by gaokao score.',
        kolej: 'Higher vocational college: three-year diplomas and trades.',
        library: 'City library: self-study, tutoring gigs and freelance work.',
        hall: 'Community centre: the residents’ committee, clubs and events.',
        hq: 'Headquarters tower of one of the richest companies in the city.',
        office: 'Office building: sales, accounting and management jobs; home to bigger companies.',
        bank: 'Bank: business loans and bank clerk jobs.',
        bursa: 'Jade River Exchange, the stock exchange. Click to open the stock market.',
        mall: 'The mall: shop and cleaning jobs, event staff and ride-hailing gigs.',
        shoplot: 'A shopfront for a small business.',
        hospital: 'People’s Hospital, the public hospital. Medical insurance pays most of the bill after the deductible.',
        lake: 'A lake: a walk round the shore, fishing, square dancing at dusk. Not built on.',
        hill: 'A wooded hill with a path and a pavilion at the top. Not built on.',
        forest: 'Forest park with bamboo and camphor trees. Not built on.',
        privschool: 'A private school, owned by a resident. Fee-paying families send their children here; the owner pays the teachers.',
        privhosp: 'A private hospital, owned by a resident. It earns from paying patients; the owner pays the doctors and nurses.',
        school: 'Public school: nine years of free compulsory education, then the zhongkao exam.',
        factory: 'Factory: factory worker and engineer jobs.',
        workshop: 'Repair workshop: mechanics and repair gigs.',
        warehouse: 'Logistics park: delivery riders and warehouses.',
        construction: 'Building site: hard, risky labour.',
        park: 'People’s Park: for running, tai chi and square dancing.',
        gym: 'Sports centre: workouts and sports training.',
        techhub: 'Hi-tech park: software jobs and startups.',
        researchcentre: 'Research & innovation centre: laboratory, data and research jobs.',
        welfare: 'Children’s welfare home for children without guardians.',
        padi: 'Rice paddies and vegetable plots.',
        lot: 'Empty land. New buildings appear here when the city gets crowded.',
        depot: 'Bus station and the city gateway. Newcomers arrive here.',
        memorial: 'Memorial garden. A white chrysanthemum for every founder who has passed away.',
        cinema: 'Cinema. Mid-tier entertainment.',
        karaoke: 'KTV: private karaoke rooms with friends. Mid-tier entertainment.',
        bowling: 'Bowling alley. Mid-tier entertainment.',
        futsal: 'Basketball court: pickup games with friends. Low-tier sport and leisure.',
        finedine: 'A banquet restaurant. High-tier: expensive, very satisfying, a place to be seen.',
        lounge: 'Rooftop bar. High-tier nightlife where the well-off network.',
        spa: 'Spa and foot massage: high-tier relaxation that melts stress away.',
        golf: 'Golf club. The most exclusive venue in the city: members only, where deals are made.',
        station: 'High-speed rail station: trains to the big cities. Newcomers arrive and leavers depart here; commuters ride to city jobs.',
        rail: 'High-speed railway to the big cities.',
        masjid: 'Mosque: Friday prayers, the zakat fund, Ramadan and Eid.',
        tokong: 'Buddhist temple: incense, offerings and a welfare fund.',
        kuil: 'Hindu temple.',
        gereja: 'Church: Sunday service and the church welfare fund.',
        police: 'Public Security Bureau. Patrol cars go out from here; arrest chances depend on police strength.',
        court: 'People’s Court. Most defendants are convicted; a lawyer helps those who can pay.',
        prison: 'Prison. Inmates lose their jobs; a record makes hiring harder and reoffending likelier.',
        jail: 'Detention centre: suspects wait here until the court hears their case.',
        townhall: 'Municipal government, office of the Party Secretary appointed by the province. The city collects taxes and pays for police, aid and services.',
        padang: 'People’s Square, for National Day and festival crowds.',
        rehab: 'Drug rehabilitation centre: compulsory treatment. Many relapse after leaving.',
      },
    },
    names: {
      centralBank: "People's Bank of China", policyRate: 'loan prime rate', fund: 'Qiaoyun State Assets Fund', fundReturns: 'state asset returns',
      exchange: 'Jade River Exchange', exchangeShort: 'Jade River', retirement: 'Housing Provident Fund', antiCorruption: 'discipline inspection commission', lockdown: 'Lockdown', newspaper: 'Qiaoyun Daily',
    },
    // Taxes (Year-1 yuan a year). Individual income tax: 3-45% above ¥60,000 a year, social insurance and
    // the provident fund pre-tax, ¥24,000 a year per child. Social insurance from the worker (pension 8%,
    // medical 2%, unemployment 0.5%) and the employer (pension 16%, medical ~8%, unemployment 0.5%, injury
    // ~0.5%) on pay between 60% and 300% of the local average wage. VAT 13% (food 9%, services 6%) inside
    // prices; no yearly tax on homes (business premises pay property and land-use taxes); company tax 25%
    // (5% on the first ¥3M for small firms); dividends 10% (shares held under a year); no inheritance tax.
    tax: {
      incomeBands: [[36000, 0.03], [144000, 0.1], [300000, 0.2], [420000, 0.25], [660000, 0.3], [960000, 0.35], [Infinity, 0.45]],
      personalRelief: 60000,
      retirementRelief: { rate: 0.175, cap: 47250 }, // social insurance + provident fund, up to 300% of the average wage
      childRelief: 24000,
      rebate: { amount: 0, upTo: 0 },
      ni: { name: 'social insurance', employerName: 'social insurance (employers)', floor: 54000, employee: { from: 0, to: 270000, rate: 0.105, above: 0 }, employer: { from: 0, to: 270000, rate: 0.25 }, coverage: true, compliance: 0.7 }, // many employers declare less than the full wage
      companyBands: [[3000000, 0.05], [Infinity, 0.25]],
      companyRefRate: 0.25,
      largeCompanyRevenue: Infinity,
      salesTax: {
        vat13: { food: [0.09, 0.07, 0.07, 0.06], transport: [0.09, 0.13, 0.13, 0.2], leisure: [0, 0.06, 0.06, 0.06], child: 0.06, other: 0.13 },
        vat15: { food: [0.1, 0.08, 0.08, 0.07], transport: [0.1, 0.15, 0.15, 0.22], leisure: [0, 0.07, 0.07, 0.07], child: 0.07, other: 0.15 },
      },
      salesTaxNames: { vat13: 'VAT', vat15: 'VAT' },
      salesTaxRaise: 'vat15',
      priceBase: { salesTax: 'vat13', fuel: 'none' },
      assessment: 0.03, assessmentName: 'property and land-use tax',
      employerCorp: 0.04,
      eis: 0,
      // Beijing takes a share of VAT and company and income tax, but central-China provinces get more back
      // in transfers than they send, so the city keeps its taxes here.
      federalShare: {},
      fuel: { none: { px: 1, cost: 0 }, targeted: { px: 0.97, cost: 0.03 }, blanket: { px: 0.94, cost: 0.06 } },
      dividend: { above: 0, rate: 0.1 },
      zakatRebate: false,
      estateAllowance: 10000000,
    },
    // The People's Bank: one-year loan prime rate 3.0% (2025), deposits ~1%.
    bank: { policyRate: 0.03, floor: 0.01, ceiling: 0.06 },
    // Housing Provident Fund: 7% from the worker and 7% from the employer (5-12% allowed); about 45% of
    // workers have an account (formal jobs); paid out at retirement (or for a home).
    retirement: { employee: 0.07, employer: 0.07, participation: 0.45, accessAge: 60, dividend: { growth: 0.015, normal: 0.015, recession: 0.015 } },
    fund: { payout: 0.02 }, // local state firms pay out little
    gov: {
      appointed: { reviewYears: 5, maxTerms: 2 },
      laws: [
        { key: 'incomeTax', name: 'Income tax', def: 'normal', options: [['normal', 'National IIT bands (3-45%), set by Beijing']], econ: { normal: 0 } },
        { key: 'corpTax', name: 'Company tax', def: '25', options: [['25', '25% (national)']], econ: { '25': 0 } },
        { key: 'minWage', name: 'Minimum wage', def: '2210', options: [['1800', '¥1,800 a month (lowest class)'], ['2210', '¥2,210 a month (provincial class 1)'], ['2600', '¥2,600 a month']], econ: { '1800': 0.6, '2210': 0, '2600': -0.7 } },
        { key: 'cashAid', name: 'City hardship aid', def: '0', options: [['0', 'None (dibao only)'], ['300', '¥300/month'], ['600', '¥600/month']], econ: { '0': 0, '300': -0.5, '600': -0.9 } },
        { key: 'ubi', name: 'Universal basic income', def: '0', options: [['0', 'None'], ['1000', '¥1,000/month for every adult']], econ: { '0': 0.3, '1000': -1.3 } },
        { key: 'estateTax', name: 'Inheritance tax', def: '0', options: [['0', 'None (China has none)'], ['0.2', '20% above ¥10M']], econ: { '0': 0.6, '0.2': 0 } },
        { key: 'police', name: 'Police force', def: '2.4', options: [['1.4', '1.4 officers per 1,000'], ['2.4', '2.4 per 1,000 (with auxiliary police)'], ['3.5', '3.5 per 1,000']], soc: { '1.4': 0.5, '2.4': 0, '3.5': -0.8 }, econ: { '1.4': 0.3, '2.4': 0, '3.5': -0.3 } },
        { key: 'drugPolicy', name: 'Drug policy', def: 'national', options: [['national', 'Community rehab, then compulsory rehab'], ['punitive', 'Punitive (prison)'], ['treatment', 'Voluntary treatment first'], ['decriminalised', 'Decriminalised use']], soc: { national: -0.5, punitive: -1, treatment: 0.5, decriminalised: 1 } },
        { key: 'uniFees', name: 'University fees', def: 'subsidised', options: [['free', 'Free public universities'], ['subsidised', 'Public fees (~¥5,000 a year)'], ['expensive', 'Private-college prices (x2.5)']], econ: { free: -0.8, subsidised: 0, expensive: 0.8 } },
        { key: 'recordCheck', name: 'Criminal record checks in hiring', def: 'allowed', options: [['allowed', 'Allowed (record certificates)'], ['banned', 'Banned']], soc: { allowed: -0.3, banned: 0.7 } },
        { key: 'affirm', name: 'Preference in hiring', def: 'none', options: [['none', 'None'], ['need', 'Need-based (low income)'], ['group', 'Ethnic minority preference']], econ: { none: 0, need: -0.4, group: -0.2 }, soc: { none: 0, need: 0.2, group: 0.4 } },
        { key: 'barBan', name: 'Bars and alcohol', def: 'open', options: [['open', 'Allowed (taxed)'], ['ban', 'Banned']], soc: { open: 0.3, ban: -0.6 } },
        { key: 'fuelSubsidy', name: 'Fuel prices', def: 'none', options: [['none', 'Set by the NDRC, with fuel tax'], ['targeted', 'Fuel vouchers for low incomes'], ['blanket', 'Fuel subsidy for everyone']], econ: { none: 0, targeted: -0.3, blanket: -0.6 } },
        { key: 'salesTax', name: 'VAT', def: 'vat13', options: [['vat13', '13% (food 9%, services 6%)']], econ: { vat13: 0 } },
        { key: 'schools', name: 'Public schools', def: 'national', options: [['lean', '8 teachers per 1,000'], ['national', '9.8 per 1,000 (China)'], ['generous', '11.5 per 1,000']], econ: { lean: 0.5, national: 0, generous: -0.5 } },
        { key: 'health', name: "People's hospital and clinics", def: 'national', options: [['lean', 'Lean (3 nurses, 2.5 doctors per 1,000)'], ['national', 'China today (4 nurses, 3.4 doctors)'], ['generous', 'Generous (5 nurses, 4 doctors)']], econ: { lean: 0.5, national: 0, generous: -0.5 } },
      ],
      leaderTitles: { president: 'Party Secretary', mayor: 'Mayor', datuk: 'Mayor' },
      leaderPay: { share: 0.02, min: 9000, max: 20000 },
      policePer1000: 2.4,
      servicePay: { teacher: 9000, nurse: 8500, doctor: 17000 }, // pay + employer social insurance
      council: {
        treasurer: { title: 'Director of the Finance Bureau', en: 'Finance Bureau', does: 'Collects taxes and splits the budget. A weak or corrupt director loses revenue to evasion and development money to waste.' },
        police: { title: 'Director of Public Security', en: 'Public Security Bureau', does: 'Leads the police: how many cases get solved and how hard gangs are pushed.' },
        community: { title: 'Director of Civil Affairs', en: 'Civil Affairs Bureau', does: 'Runs dibao, hardship aid, unemployment insurance and training places for people out of work.' },
      },
      trainCost: 1500,
      officialGroups: ['han', 'zhuang', 'hui', 'manchu', 'uyghur'],
      preferredGroups: ['zhuang', 'hui', 'manchu', 'uyghur', 'other'],
      austerity: [['ubi', { 1000: '0' }], ['cashAid', { 600: '300', 300: '0' }], ['fuelSubsidy', { blanket: 'targeted', targeted: 'none' }], ['health', { generous: 'national' }], ['schools', { generous: 'national' }]],
      emergency: { aid: ['cashAid', { 0: '300' }], police: ['police', { 1.4: '2.4', 2.4: '3.5' }] },
      surplus: {
        cuts: [['estateTax', { 0.2: '0' }], ['fuelSubsidy', { blanket: 'targeted' }]],
        spends: [['health', { lean: 'national', national: 'generous' }], ['schools', { lean: 'national', national: 'generous' }], ['cashAid', { 0: '300', 300: '600' }]],
      },
    },
    services: {
      schools: { lean: 8, national: 9.8, generous: 11.5 },
      health: { lean: [3, 2.5], national: [4, 3.4], generous: [5, 4] },
      charges: { minor: 1, share: 0.05 }, // (Chinese bills go through medical insurance below)
    },
    // Basic medical insurance (NHSA 2024): employees' insurance through social insurance (a deductible of
    // ~¥1,300, ~80% refunded), residents' insurance for everyone else (¥400 a year, ~60-70% refunded at
    // home, less for care away from where the hukou is). Care costs ~1.3x the engine's prices; out-of-pocket
    // spending is ~27% of health costs. Funds are public, so the treasury pays the insured part.
    health: {
      model: 'china',
      priceMult: 1.3, selfPay: 1,
      plans: {
        employee: { premium: 0, deductible: 1300, coins: 0.2, oopMax: 30000, public: true },
        resident: { premium: 33, deductible: 800, coins: 0.35, oopMax: 50000, public: true },
        residentAway: { premium: 33, deductible: 1500, coins: 0.55, oopMax: 80000, public: true },
      },
      residentTakeUp: 0.95,
    },
    // Welfare: unemployment insurance (~90% of the minimum wage, up to 12-24 months), the employees' basic
    // pension (1% of the average of the local wage and the person's indexed wage per year contributed, plus
    // the personal account / 139 months at 60), the residents' pension (~¥230 a month), dibao for local hukou
    // (urban ~¥800, rural ~¥640 per person a month), the childcare subsidy (¥300 a month under 3) and
    // migrant children's school costs.
    welfare: {
      model: 'china',
      jobLoss: { flat: 1990, days: 365, needsSi: true },
      pension: {
        avgWage: 7500, minYears: 15, minYearsFrom: 2030, minYearsTo: 20, personal: 0.08,
        divisor: { 50: 195, 55: 170, 58: 152, 60: 139, 63: 117 }, resident: 230,
        // State Council 2024: from January 2025 men 60 -> 63 (1 month every 4 months), women 55 -> 58
        // (every 4 months) and women in blue-collar jobs 50 -> 55 (every 2 months).
        startYear: 2025, men: [60, 63, 4], women: [55, 58, 4], womenWorkers: [50, 55, 2],
        workerJobs: ['cleaner', 'retail', 'rider', 'factory', 'construction', 'chef'],
      },
      dibao: { urban: 800, rural: 640, assetMonths: 12, takeUp: 0.7 },
      childcare: { monthly: 300, under: 3 },
      migrantSchool: 300,
    },
    // Hukou (household registration): local urban, local rural or from outside. People switch to a local
    // urban hukou after 5 years of social insurance, with a degree or with a home in a high-rise estate (if they want to).
    hukou: {
      mix: { urban: 0.5, rural: 0.25, outside: 0.25 },
      names: { urban: 'Local urban hukou', rural: 'Local rural hukou', outside: 'Hukou elsewhere (migrant)' },
      short: { urban: 'Urban', rural: 'Rural', outside: 'Migrant' },
      // Social insurance coverage of jobs (NBS migrant worker survey: ~30% of migrants have employee pension cover).
      coverage: { urban: 0.65, rural: 0.4, outside: 0.3 }, // (MOHRSS: ~380m pay into the employees' pension of ~740m employed)
      convert: { siYears: 5, homeTier: 3, willing: 0.5 }, // about half of rural migrants keep their village hukou (land rights)
      // Starting wealth: NBS 2024 urban/rural income ratio 2.34; migrants in between. The average is unchanged.
      startWealth: { urban: 1, rural: 0.43, outside: 0.6 },
    },
    // Nine free school years; the zhongkao sends ~55% to academic high schools, the rest to vocational
    // schools; university places go by gaokao score in the province of the hukou.
    education: {
      vocIsced: 5, // a higher vocational diploma (dazhuan) is ISCED 5 (C02)
      // C06 (approximate, from the 2020 census by age and MoE 2023 intake; not official targets): founders' bachelor's-
      // or-higher and dazhuan shares by age group; yearly entry places per age cohort (today's high intake).
      founders: [[25, 0.15, 0.15], [35, 0.22, 0.2], [45, 0.12, 0.12], [55, 0.06, 0.07], [65, 0.03, 0.04], [200, 0.02, 0.02]], places: { bach: 0.3, master: 0.05, voc: 0.3 }, admitBar: 1, // (plus the gaokao bars)
      gaokao: { academic: 0.55, bar: 1, vocationalBar: 2.5, awayBar: 0.5, zhongkaoAge: 15 },
    },
    settings: {
      preset: { options: { national: "Today's rules (calibrated to Chinese data)" }, help: 'Fills the settings below. China: ~1.0 children per woman, ~79-year life expectancy, hukou, social insurance and an appointed government.' },
      founders: { help: 'Strangers who found the city. The map size follows (100 = a small village).' },
      inflMin: { help: 'China CPI: 2024 averaged 0.2%; 2025 about 0%.' },
      inflMax: { help: 'China CPI: the 2010s ranged 1.4-5.4%.' },
      fertility: { options: { national: 'China today (~1.0 children per woman)' } },
      mortMult: { help: '1 = original engine (~80-year lives) = China (79 years). 0 = nobody dies of old age.' },
      society: { options: { on: 'On (income class, religion, festivals)' } },
      ethnicMix: { options: { national: 'China 2020 census (Han 91%, minorities)' } },
      interfaith: { options: { national: 'Free choice' } },
      drugPolicy: { options: { national: 'China (community rehab, then compulsory rehab)' } },
      government: { label: 'Government', options: { on: 'On (appointed leaders, taxes, laws)' } },
      termYears: { label: 'Years between provincial reviews' },
      termLimit: { help: 'Appointed leaders are moved on after two terms in any case (cadre rotation).' },
      identityVoting: { label: 'Identity in appointments', help: 'There are no elections: the province appoints the leader. (Kept for other countries.)' },
      freezeLaws: { options: { no: 'No: the leader changes the city laws' } },
      groupWealth: { label: 'Starting wealth by hukou', help: 'Realistic: rural and migrant hukou holders start poorer (NBS urban/rural income ratio 2.34). Equal: everyone draws from the same spread.' },
    },
    society: {
      religions: {
        islam: { name: 'Islam', icon: '☪️', colour: '#2a9d8f', place: 'masjid', day: 4, slot: 0, mean: 62, fund: 'Zakat fund', festival: 'raya', worship: 'Prayers at the mosque' },
        buddhism: { name: 'Buddhism', icon: '☸️', colour: '#f4a261', place: 'tokong', day: -1, slot: 1, mean: 40, fund: 'Temple fund', festival: null, worship: 'Incense at the temple' },
        christianity: { name: 'Christianity', icon: '✝️', colour: '#5aa9e6', place: 'gereja', day: 6, slot: 0, mean: 52, fund: 'Church fund', festival: 'christmas', worship: 'Sunday service' },
        hinduism: { name: 'Hinduism', icon: '🕉️', colour: '#e76f51', place: 'kuil', day: -1, slot: 1, mean: 55, fund: 'Temple welfare fund', festival: 'deepavali', worship: 'Prayers at the temple' },
        other: { name: 'Taoism & folk religion', icon: '☯️', colour: '#b892ff', place: 'tokong', day: -1, slot: 1, mean: 30, fund: 'Temple fund', festival: null, worship: 'Offerings at the temple' },
        none: { name: 'No religion', icon: '○', colour: '#9aa5b1', place: null, mean: 6 },
      },
      // CGSS and Pew 2023: ~90% name no religion (many still keep folk customs); Buddhists ~4-7%,
      // Christians ~2%, Muslims ~2% (mostly Hui and Uyghur).
      relByEth: {
        han: { none: 0.86, buddhism: 0.07, other: 0.04, christianity: 0.028, islam: 0.002 },
        zhuang: { none: 0.78, other: 0.14, buddhism: 0.05, christianity: 0.03 },
        hui: { islam: 0.9, none: 0.1 },
        manchu: { none: 0.85, buddhism: 0.08, other: 0.05, christianity: 0.02 },
        uyghur: { islam: 0.9, none: 0.1 },
        other: { none: 0.4, buddhism: 0.28, other: 0.25, christianity: 0.05, islam: 0.02 },
      },
      celebrates: { cny: { all: true }, nationalday: { all: true }, midautumn: { all: true }, dragonboat: { all: true }, qingming: { all: true }, raya: { rel: 'islam' }, christmas: { rel: 'christianity' } },
      classNames: { B40: 'Lower income · bottom 40%', M40: 'Middle income · middle 40%', T20: 'Higher income · top 20%' },
      classShort: { B40: 'Bottom 40%', M40: 'Middle 40%', T20: 'Top 20%' },
      statsOffice: 'NBS', cutsYear: 2024,
      // Household income per month at the 40th and 80th percentiles (NBS 2024 per-person disposable income
      // quintiles x 2.62 people per household: ~¥5,900 and ~¥13,100), poverty line ~¥800 per person (dibao).
      bottom40Max: 5900, top20Min: 13100, hardship: 800,
      nisab: 60000,
      nonShariah: ['QYBK', 'ANIN'],
      lawReligion: null,
    },
    calendar: {
      festivals: [
        { id: 'newyear', name: "New Year's Day", doy: 0, span: 1 },
        { id: 'cny', name: 'Spring Festival', doy: 47, lo: 21, span: 7, lunisolar: true }, // 17 Feb 2026, 6 Feb 2027, 26 Jan 2028...
        { id: 'qingming', name: 'Qingming Festival', doy: 94, span: 1 },
        { id: 'raya', name: 'Eid al-Fitr', doy: 78, span: 2, lunar: true },
        { id: 'labour', name: 'Labour Day holiday', doy: 120, span: 5 },
        { id: 'dragonboat', name: 'Dragon Boat Festival', doy: 169, lo: 147, span: 1, lunisolar: true },
        { id: 'midautumn', name: 'Mid-Autumn Festival', doy: 267, lo: 250, span: 1, lunisolar: true },
        { id: 'nationalday', name: 'National Day Golden Week', doy: 273, span: 7 },
        { id: 'christmas', name: 'Christmas', doy: 358, span: 1 },
      ],
      fast: { before: 'raya', days: 30 },
    },
    // The look: high-rise estates, older walk-up blocks, urban villages, rice paddies; central-China
    // seasons at ~30N (hot humid summers, cold damp winters, rare snow); no daylight saving time.
    art: {
      style: 'cn',
      latitude: 30.5,
      seasons: true,
      weather: { rain: [0.3, 0.33, 0.42, 0.45, 0.45, 0.5, 0.42, 0.35, 0.3, 0.3, 0.28, 0.25], heavy: 0.18, snow: { months: [0, 1, 11], chance: 0.04 } },
      hazeSky: { id: 'haze', name: 'Smog' },
      outfits: [['raya', { rel: 'islam' }, 'kurta', 'kurung'], ['christmas', { rel: 'christianity' }, 'office', 'office'], ['cny', {}, 'cny', 'cny'], ['nationalday', {}, 'office', 'office']],
      decor: { cny: 'lanterns', midautumn: 'lanterns', nationalday: 'flags', raya: 'homeLights', christmas: 'mallTree' },
      flag: { stripes: ['#de2910', '#de2910'], canton: '#de2910', star: '#ffde00' },
      fireworks: ['cny', 'nationalday'],
      festivalTracks: ['cny'],
    },
    gangNames: { pattern: 'The {a} {b}', a: ['Black', 'Red', 'Iron', 'Jade', 'Golden', 'River', 'East', 'Night'], b: ['Dragons', 'Tigers', 'Snakes', 'Brothers', 'Gang', 'Hall'] },
    // TFR ~1.0 (UN WPP 2024, 2023); life expectancy 79.0 (NBS 2024).
    // Share of job openings that go to someone from outside town (Phase 6: sets unemployment).
    labour: { outsideHire: 0.5, paySd: 0.55, market: 1.3 },
    demography: { fertMult: 0.47, mortMult: 1 }, // Phase 6 markets: TFR 0.73 at 0.34; // 80-year runs: TFR 0.88 at 0.3 and life expectancy 76.9 at 1.15
    defaults: { goalRM: 200000000, marketOutsideRM: 460000000, mortMult: 1, leaderTitle: 'president', termYears: 5, inflMin: -1, inflMax: 4 },
    // Crime per 100k a year for the offences the engine models (approximate: the MPS reports ~3.1m criminal
    // cases filed in 2024, ~220 per 100k, after a 25.7% fall; thefts, robbery and violence are about two
    // thirds; murder ~0.5). Prisoners ~1.69m sentenced (~120 per 100k). Registered drug users 896,000 (~64).
    crime: { index: 150, violent: 30, property: 120, murder: 0.5, users: 64, prison: 120 },
    // Tuned (3 seeds x 40 years at the Realistic scale: index ~250, 56% solved, ~177 prisoners, ~72 users per 100k):
    // police solve more than in Malaysia, short sentences and many suspended ones, compulsory rehab before
    // prison, few guns, and far less drug use.
    crimeTuning: { opportunity: 0.5, clear: 0.7, community: 0.55, drugRepeat: 2, sentence: 0.15, lethal: 0.5, drugUse: 0.1 }, // (Phase 6: index 243, 214 prisoners, 187 users at 1.15 / 0.3 / 0.15)
    events: {
      flood: { doy: 180, chance: 0.3, relief: 2000, name: 'Summer floods' },
      haze: { doy: 340, chance: 0.4, days: 14, name: 'Smog', text: 'Winter smog: the air is unhealthy for two weeks' },
    },
    calibration: {
      tertiary: { target: 0.2, band: 0.07, src: 'Census 2020 and OECD: ~20% of 25-64 year-olds with a college diploma or degree' },
      tfr: { target: 1.0, band: 0.3, src: 'UN World Population Prospects 2024 (TFR ~1.0 in 2023)' },
      e0: { target: 79, band: 3, src: 'NBS Statistical Communique 2024 (79.0)' },
      unemp: { target: 0.051, band: 0.015, src: 'NBS surveyed urban unemployment, 2024 average (5.1%)' },
      medWage: { target: 6000, band: 1500, src: 'NBS 2024: urban non-private units ¥10,343 a month, private units ¥5,790; median in a central-China city ~¥6,000 (approximate)' },
      hhGini: { target: 0.465, band: 0.06, src: 'NBS income Gini (~0.465)' },
      starve: { target: 0, band: 0.01, src: 'No deaths from hunger' },
      crimeIdx: { target: 150, band: 80, src: 'MPS criminal cases filed 2024 (~3.1m), modelled offences (approximate)' },
      drugUsers: { target: 64, band: 40, src: 'China Drug Situation Report 2023: 896,000 registered users' },
      prison: { target: 120, band: 40, src: 'World Prison Brief: ~1.69m sentenced prisoners' },
      clearance: { target: 0.5, band: 0.15, src: 'Approximate: violent crimes are nearly all solved, thefts much less' },
      revenue: { target: 2000, band: 600, src: 'General budget (¥22.0tn) + social insurance funds (~¥12tn) / 1.408bn people, 2024' },
    },
    notes: {
      revenue: 'China ~¥2,000 incl. general budget and social insurance',
      events: 'Summer rains flood low-lying districts (¥2,000 relief per household hit); winter smog hurts health for two weeks.',
      laws: 'National laws (income tax, company tax, VAT, social insurance) are set in Beijing. The city sets the minimum wage class, hardship aid, police, teachers, nurses and doctors, how drug users are treated, university fees, record checks, hiring preference, alcohol and fuel help.',
      taxes: 'Taxes follow China: individual income tax (3-45% above ¥60,000 a year, ¥2,000 a month per child), social insurance (10.5% from workers, ~25% from employers, between 60% and 300% of the average wage), the Housing Provident Fund (7% + 7%), VAT 13% (food 9%, services 6%) inside prices, property tax on business premises only, 25% company tax (5% for small firms) and 10% on dividends.',
      bank: "The People's Bank sets the loan prime rate (3.0% in 2025); the city economy moves it between 1% and 6%.",
      council: 'The province appoints the Party Secretary and reviews them every five years on growth, stability, debt and scandal. Leaders who care less about merit may appoint friends to the bureaus. The discipline inspection commission catches officials who take bribes.',
      glcLater: 'Once the finances are sound, local state-owned companies list on the Jade River Exchange and pay dividends to the State Assets Fund.',
    },
  });
})(globalThis.LES = globalThis.LES || {});
