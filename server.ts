import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Parse CLI flags or env vars
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const hostIndex = args.indexOf('--host');

const PORT = portIndex !== -1 && args[portIndex + 1]
  ? parseInt(args[portIndex + 1], 10)
  : parseInt(process.env.PORT || '3000', 10);

const HOST = hostIndex !== -1 && args[hostIndex + 1]
  ? args[hostIndex + 1]
  : (process.env.HOST || '0.0.0.0');

const isProd = process.env.NODE_ENV === 'production';

// Enable CORS and OPTIONS handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with telemetry User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface BookInput {
  id?: string;
  title: string;
  authors: string[];
  status?: string;
  rating?: number;
  genres?: string[];
  notes?: string;
  pages?: number;
}

interface RecommendedBookItem {
  id: string;
  title: string;
  author: string;
  genres: string[];
  matchScore: number;
  reason: string;
  description: string;
  estimatedPages: number;
  keyThemes: string[];
  coverColor: string;
}

// Curated literary database for robust fallback recommendations across genres
const CURATED_GOLD_LIBRARY: RecommendedBookItem[] = [
  // АНТИУТОПИЯ
  {
    id: 'gold-anti-1',
    title: '1984',
    author: 'Джордж Оруэлл',
    genres: ['Антиутопия', 'Фантастика', 'Классика'],
    matchScore: 98,
    reason: 'Фундаментальное исследование свободы мысли, пропаганды и тотального контроля.',
    description: 'Мир Океании под надзором Старшего Брата, где даже тайные мысли считаются тягчайшим преступлением.',
    estimatedPages: 320,
    keyThemes: ['Свобода', 'Тоталитаризм', 'Правда'],
    coverColor: '#2C3E50',
  },
  {
    id: 'gold-anti-2',
    title: 'О дивный новый мир',
    author: 'Олдос Хаксли',
    genres: ['Антиутопия', 'Фантастика', 'Философия'],
    matchScore: 97,
    reason: 'Идеальное предупреждение об обществе стандартизированного генетического потребления.',
    description: 'Технократическое общество без боли и страданий, где человеческая душа заменена синтетическим счастьем.',
    estimatedPages: 288,
    keyThemes: ['Потребление', 'Индивидуальность', 'Технологии'],
    coverColor: '#1B4965',
  },
  {
    id: 'gold-anti-3',
    title: 'Мы',
    author: 'Евгений Замятин',
    genres: ['Антиутопия', 'Фантастика', 'Классика'],
    matchScore: 96,
    reason: 'Шедевр отечественной литературы, заложивший основы мирового жанра антиутопии.',
    description: 'Единое Государство из стекла, где граждане носят номера, пока инженер Д-503 не открывает в себе чувство любви.',
    estimatedPages: 224,
    keyThemes: ['Душа', 'Логика vs Чувства', 'Бунт'],
    coverColor: '#34495E',
  },
  {
    id: 'gold-anti-4',
    title: '451° по Фаренгейту',
    author: 'Рэй Брэдбери',
    genres: ['Антиутопия', 'Фантастика', 'Философия'],
    matchScore: 96,
    reason: 'Вдохновенная ода печатному слову, живому диалогу и сохранению культурной памяти.',
    description: 'Пожарный Гай Монтэг сжигает книги по приказу властей, пока случайная встреча не заставляет его задуматься.',
    estimatedPages: 256,
    keyThemes: ['Книги', 'Память', 'Прозрение'],
    coverColor: '#873600',
  },
  {
    id: 'gold-anti-5',
    title: 'Скотный двор',
    author: 'Джордж Оруэлл',
    genres: ['Антиутопия', 'Сатира', 'Классика'],
    matchScore: 95,
    reason: 'Остроумная и безжалостная притча о перерождении революционных идеалов.',
    description: 'Животные прогоняют жестокого фермера, провозглашая всеобщее равенство, пока свиньи не захватывают власть.',
    estimatedPages: 140,
    keyThemes: ['Власть', 'Идеология', 'Равенство'],
    coverColor: '#5B2C6F',
  },

  // ФАНТАСТИКА
  {
    id: 'gold-sci-1',
    title: 'Дюна',
    author: 'Фрэнк Герберт',
    genres: ['Фантастика', 'Космоопера', 'Приключения'],
    matchScore: 99,
    reason: 'Монументальная фантастическая сага об экологии, религии и борьбе за власть во Вселенной.',
    description: 'Пустынный Арракис таит в себе самое ценное вещество Галактики — пряность, за которую развязывается межзвездная война.',
    estimatedPages: 704,
    keyThemes: ['Власть', 'Экология', 'Предназначение'],
    coverColor: '#C47335',
  },
  {
    id: 'gold-sci-2',
    title: 'Цветы для Элджернона',
    author: 'Дэниел Киз',
    genres: ['Фантастика', 'Психология', 'Драма'],
    matchScore: 98,
    reason: 'Пронзительная история об эволюции интеллекта, одиночестве и ценности человеческого сердца.',
    description: 'Чарли соглашается на экспериментальную операцию на мозге, стремительно обгоняя в развитии своих учителей.',
    estimatedPages: 320,
    keyThemes: ['Интеллект', 'Сострадание', 'Одиночество'],
    coverColor: '#5C3D2E',
  },
  {
    id: 'gold-sci-3',
    title: 'Солярис',
    author: 'Станислав Лем',
    genres: ['Фантастика', 'Философия', 'Детектив'],
    matchScore: 97,
    reason: 'Глубочайшее исследование границ человеческого познания и контакта с Непостижимым.',
    description: 'Психолог Крис Кельвин прибывает на исследовательскую станцию над мыслящим Океаном планеты Солярис.',
    estimatedPages: 288,
    keyThemes: ['Контакт', 'Память', 'Совесть'],
    coverColor: '#1A5276',
  },
  {
    id: 'gold-sci-4',
    title: 'Гиперион',
    author: 'Дэн Симмонс',
    genres: ['Фантастика', 'Космоопера', 'Философия'],
    matchScore: 96,
    reason: 'Грандиозный фантастический роман в духе Кентерберийских рассказов о судьбе человечества.',
    description: 'Семеро паломников отправляются на планету Гиперион к Гробницам Времени и чудовищу Шрайку.',
    estimatedPages: 560,
    keyThemes: ['Время', 'Судьба', 'Бог и человек'],
    coverColor: '#4A235A',
  },
  {
    id: 'gold-sci-5',
    title: 'Задача трех тел',
    author: 'Лю Цысинь',
    genres: ['Фантастика', 'Наука', 'Триллер'],
    matchScore: 95,
    reason: 'Захватывающая дух современная научная фантастика о первом контакте с внеземной цивилизацией.',
    description: 'Секретный военный проект отправляет сигналы в глубокий космос, привлекая внимание гибнущей цивилизации Трисоляриса.',
    estimatedPages: 464,
    keyThemes: ['Космос', 'Наука', 'Выживание'],
    coverColor: '#196F3D',
  },
  {
    id: 'gold-sci-6',
    title: 'Пикник на обочине',
    author: 'Аркадий и Борис Стругацкие',
    genres: ['Фантастика', 'Приключения', 'Философия'],
    matchScore: 98,
    reason: 'Культовое произведение о Зоне Посещения и Золотом Шаре, исполняющем желания.',
    description: 'Сталкер Рэдрик Шухарт рискует жизнью ради поиска внеземных артефактов в смертоносной аномальной Зоне.',
    estimatedPages: 240,
    keyThemes: ['Желания', 'Счастье для всех', 'Опасность'],
    coverColor: '#212F3D',
  },

  // КЛАССИКА
  {
    id: 'gold-class-1',
    title: 'Мастер и Маргарита',
    author: 'Михаил Булгаков',
    genres: ['Классика', 'Мистика', 'Философия'],
    matchScore: 99,
    reason: 'Великий шедевр о вечной любви, человеческой совести и природе добра и зла.',
    description: 'Визит Воланда в советскую Москву переплетается с ершалаимской историей Пилата и Иешуа.',
    estimatedPages: 480,
    keyThemes: ['Истина', 'Любовь', 'Справедливость'],
    coverColor: '#4A1521',
  },
  {
    id: 'gold-class-2',
    title: 'Преступление и наказание',
    author: 'Фёдор Достоевский',
    genres: ['Классика', 'Психология', 'Философия'],
    matchScore: 98,
    reason: 'Непревзойденный психологический роман о границах человеческой воли и искуплении.',
    description: 'Родион Раскольников проверяет свою теорию о праве на преступление, сталкиваясь с муками совести.',
    estimatedPages: 576,
    keyThemes: ['Совесть', 'Искупление', 'Душа'],
    coverColor: '#1C2833',
  },
  {
    id: 'gold-class-3',
    title: 'Сто лет одиночества',
    author: 'Габриэль Гарсиа Маркес',
    genres: ['Классика', 'Магический реализм', 'Драма'],
    matchScore: 96,
    reason: 'Поэтичный и завораживающий эпос о бесконечном круговороте человеческих страстей.',
    description: 'История семи поколений семьи Буэндиа в затерянном среди болот городке Макондо.',
    estimatedPages: 480,
    keyThemes: ['Судьба', 'Одиночество', 'Семья'],
    coverColor: '#B07D62',
  },
  {
    id: 'gold-class-4',
    title: 'Мартин Иден',
    author: 'Джек Лондон',
    genres: ['Классика', 'Драма', 'Биография'],
    matchScore: 95,
    reason: 'Мощнейшая мотивационная драма о несгибаемой силе воли, самообразовании и успехе.',
    description: 'Простой матрос преодолевает колоссальные испытания, чтобы стать признанным писателем ради любимой.',
    estimatedPages: 448,
    keyThemes: ['Воля', 'Труд', 'Успех'],
    coverColor: '#512E5F',
  },
  {
    id: 'gold-class-5',
    title: 'Убить пересмешника',
    author: 'Харпер Ли',
    genres: ['Классика', 'Драма', 'Воспитание'],
    matchScore: 95,
    reason: 'Теплая и мудрая книга о справедливости, сострадании и честности перед самим собой.',
    description: 'Взросление девочки Глазастика в маленьком городке и благородный пример ее отца-адвоката Аттикуса Финча.',
    estimatedPages: 416,
    keyThemes: ['Справедливость', 'Честность', 'Семья'],
    coverColor: '#2B580C',
  },
  {
    id: 'gold-class-6',
    title: 'Три товарища',
    author: 'Эрих Мария Ремарк',
    genres: ['Классика', 'Драма', 'Романтика'],
    matchScore: 96,
    reason: 'Пронзительный роман о неподдельной дружбе и хрупком счастье потерянного поколения.',
    description: 'Фронтовые друзья держат автомастерскую в предвоенной Германии, пока Роберт не встречает Пат.',
    estimatedPages: 480,
    keyThemes: ['Дружба', 'Любовь', 'Жизнь'],
    coverColor: '#145A32',
  },

  // ДЕТЕКТИВ И ТРИЛЛЕР
  {
    id: 'gold-det-1',
    title: 'Десять негритят (И никого не стало)',
    author: 'Агата Кристи',
    genres: ['Детектив', 'Триллер', 'Классика'],
    matchScore: 98,
    reason: 'Эталон классического герметичного детектива с гениальной сюжетной интригой.',
    description: 'Десять незнакомцев оказываются на отрезанном от мира острове, где их настигает возмездие по считалочке.',
    estimatedPages: 256,
    keyThemes: ['Возмездие', 'Тайна', 'Герметичный детектив'],
    coverColor: '#34495E',
  },
  {
    id: 'gold-det-2',
    title: 'Шерлок Холмс. Собака Баскервилей',
    author: 'Артур Конан Дойл',
    genres: ['Детектив', 'Приключения', 'Мистика'],
    matchScore: 97,
    reason: 'Вершина детективного дедуктивного метода в мрачной атмосфере девонширских болот.',
    description: 'Легенда о призрачной собаке преследует древний род Баскервилей, требуя гениального вмешательства сыщика.',
    estimatedPages: 220,
    keyThemes: ['Дедукция', 'Логика', 'Тайна'],
    coverColor: '#1B2631',
  },
  {
    id: 'gold-det-3',
    title: 'Девушка с татуировкой дракона',
    author: 'Стиг Ларссон',
    genres: ['Детектив', 'Триллер', 'Криминал'],
    matchScore: 95,
    reason: 'Захватывающий скандинавский триллер с яркими героями и сложным семейным расследованием.',
    description: 'Журналист Микаэль Блумквист и хакерша Лисбет Саландер расследуют таинственное исчезновение сорокалетней давности.',
    estimatedPages: 624,
    keyThemes: ['Расследование', 'Справедливость', 'Тайна семьи'],
    coverColor: '#17202A',
  },
  {
    id: 'gold-det-4',
    title: 'Молчание ягнят',
    author: 'Томас Харрис',
    genres: ['Триллер', 'Детектив', 'Психология'],
    matchScore: 96,
    reason: 'Интеллектуальный психологический триллер о дуэли стажера ФБР и гениального маньяка.',
    description: 'Кларисса Старлинг вынуждена обратиться за помощью к заключенному доктору Ганнибалу Лектеру ради поимки убийцы.',
    estimatedPages: 384,
    keyThemes: ['Психология', 'Интеллект', 'Страх'],
    coverColor: '#78281F',
  },
  {
    id: 'gold-det-5',
    title: 'Имя розы',
    author: 'Умберто Эко',
    genres: ['Детектив', 'История', 'Философия'],
    matchScore: 97,
    reason: 'Грандиозный интеллектуальный детектив в средневековом монастыре о силе запретных книг.',
    description: 'Францисканский монах Вильгельм Баскервильский расследует серию загадочных смертей в бенедиктинском аббатстве.',
    estimatedPages: 672,
    keyThemes: ['Знание', 'Истина', 'Средневековье'],
    coverColor: '#4A235A',
  },

  // ФЭНТЕЗИ
  {
    id: 'gold-fan-1',
    title: 'Властелин Колец',
    author: 'Дж. Р. Р. Толкин',
    genres: ['Фэнтези', 'Эпос', 'Приключения'],
    matchScore: 99,
    reason: 'Главный фэнтези-эпос всех времен о борьбе добра и зла, дружбе и самопожертвовании.',
    description: 'Фродо Бэггинс несет Кольцо Всевластья в пламя Роковой Горы, пока народы Средиземья ведут войну за выживание.',
    estimatedPages: 1120,
    keyThemes: ['Дружба', 'Надежда', 'Свет против тьмы'],
    coverColor: '#145A32',
  },
  {
    id: 'gold-fan-2',
    title: 'Ведьмак. Последнее желание',
    author: 'Анджей Сапковский',
    genres: ['Фэнтези', 'Приключения', 'Мифология'],
    matchScore: 97,
    reason: 'Яркое славянское фэнтези с постмодернистской иронией, глубокими героями и моральными дилеммами.',
    description: 'Геральт из Ривии — профессиональный охотник на чудовищ в мире, где люди часто опаснее любых монстров.',
    estimatedPages: 384,
    keyThemes: ['Меньшее зло', 'Судьба', 'Чудовища и люди'],
    coverColor: '#283747',
  },
  {
    id: 'gold-fan-3',
    title: 'Имя ветра',
    author: 'Патрик Ротфусс',
    genres: ['Фэнтези', 'Магия', 'Приключения'],
    matchScore: 96,
    reason: 'Поэтичный и завораживающий рассказ легендарного мага и музыканта Квоута о своей жизни.',
    description: 'Квоут скрывается под видом трактирщика, вспоминая свое детство в труппе бродячих артистов и обучение в Университете.',
    estimatedPages: 672,
    keyThemes: ['Музыка', 'Имена', 'Легенда'],
    coverColor: '#0E6251',
  },
  {
    id: 'gold-fan-4',
    title: 'Гарри Поттер и узник Азкабана',
    author: 'Дж. К. Роулинг',
    genres: ['Фэнтези', 'Приключения', 'Магия'],
    matchScore: 96,
    reason: 'Поворотная и самая атмосферная книга саги о взрослении, семейных тайнах и храбрости.',
    description: 'Из неприступной тюрьмы бежит Сириус Блэк, а школу волшебства Хогвартс окружают жуткие стражи-дементоры.',
    estimatedPages: 448,
    keyThemes: ['Дружба', 'Патронус', 'Правда о прошлом'],
    coverColor: '#78281F',
  },
  {
    id: 'gold-fan-5',
    title: 'Благие знамения',
    author: 'Нил Гейман, Терри Пратчетт',
    genres: ['Фэнтези', 'Юмор', 'Философия'],
    matchScore: 95,
    reason: 'Искрометная английская сатира об ангеле и демоне, сдружившихся ради спасения Земли.',
    description: 'Приближается Апокалипсис, но ангел Азирафаэль и демон Кроули слишком полюбили земную жизнь, чай и «Бентли».',
    estimatedPages: 512,
    keyThemes: ['Юмор', 'Человечность', 'Дружба'],
    coverColor: '#B7950B',
  },

  // ПСИХОЛОГИЯ И САМОРАЗВИТИЕ
  {
    id: 'gold-psy-1',
    title: 'Сказать жизни «Да!»: Психолог в концлагере',
    author: 'Виктор Франкл',
    genres: ['Психология', 'Философия', 'Биография'],
    matchScore: 99,
    reason: 'Великая жизнеутверждающая книга об обретении внутреннего смысла в любых обстоятельствах.',
    description: 'Основатель логотерапии делится опытом выживания в Освенциме, доказывая, что человека держит цель и смысл.',
    estimatedPages: 240,
    keyThemes: ['Смысл жизни', 'Стойкость', 'Внутренняя свобода'],
    coverColor: '#1B4F72',
  },
  {
    id: 'gold-psy-2',
    title: 'Думай медленно... решай быстро',
    author: 'Даниэль Канеман',
    genres: ['Психология', 'Наука', 'Нон-фикшн'],
    matchScore: 98,
    reason: 'Фундаментальный труд нобелевского лауреата о когнитивных искажениях и механизмах нашего мышления.',
    description: 'Система 1 (быстрая, интуитивная) и Система 2 (медленная, аналитическая): как они управляют нашими решениями.',
    estimatedPages: 656,
    keyThemes: ['Мышление', 'Логика', 'Принятие решений'],
    coverColor: '#196F3D',
  },
  {
    id: 'gold-psy-3',
    title: 'Поток: Психология оптимального переживания',
    author: 'Михай Чиксентмихайи',
    genres: ['Психология', 'Саморазвитие', 'Философия'],
    matchScore: 96,
    reason: 'Исследование состояния полного погружения и истинного счастья в созидательной деятельности.',
    description: 'Как научиться контролировать свое внимание и переживать глубокую радость в работе и творчестве.',
    estimatedPages: 464,
    keyThemes: ['Поток', 'Счастье', 'Фокус'],
    coverColor: '#0E6655',
  },
  {
    id: 'gold-psy-4',
    title: 'Атомные привычки',
    author: 'Джеймс Клир',
    genres: ['Психология', 'Саморазвитие', 'Нон-фикшн'],
    matchScore: 95,
    reason: 'Практическое и научно обоснованное руководство по трансформации жизни через микро-изменения.',
    description: 'Система маленьких шагов, которая помогает формировать полезные привычки и избавляться от вредных без стресса.',
    estimatedPages: 320,
    keyThemes: ['Привычки', 'Дисциплина', 'Результат'],
    coverColor: '#D35400',
  },

  // НОН-ФИКШН И НАУКА
  {
    id: 'gold-non-1',
    title: 'Sapiens. Краткая история человечества',
    author: 'Юваль Ной Харари',
    genres: ['Нон-фикшн', 'История', 'Наука'],
    matchScore: 98,
    reason: 'Захватывающий панорамный взгляд на эволюцию человека и силу объединяющих нас общих мифов.',
    description: 'От никому не известного африканского примата до господства над биосферой Земли.',
    estimatedPages: 512,
    keyThemes: ['Эволюция', 'Общество', 'Культура'],
    coverColor: '#1E8449',
  },
  {
    id: 'gold-non-2',
    title: 'Краткая история времени',
    author: 'Стивен Хокинг',
    genres: ['Нон-фикшн', 'Наука', 'Астрофизика'],
    matchScore: 97,
    reason: 'Доступное и гениальное объяснение тайн происхождения Вселенной, черных дыр и природы времени.',
    description: 'Путешествие от Большого взрыва до теории струн вместе с одним из величайших физиков человечества.',
    estimatedPages: 272,
    keyThemes: ['Космос', 'Черные дыры', 'Время'],
    coverColor: '#17202A',
  },
  {
    id: 'gold-non-3',
    title: 'Эгоистичный ген',
    author: 'Ричард Докинз',
    genres: ['Нон-фикшн', 'Наука', 'Биология'],
    matchScore: 96,
    reason: 'Революционная биологическая теория, изменившая взгляд на эволюцию, альтруизм и культуру.',
    description: 'Мы — машины для выживания наших генов. Автор вводит понятие мемов как единиц культурной репликации.',
    estimatedPages: 512,
    keyThemes: ['Гены', 'Эволюция', 'Мемы'],
    coverColor: '#6C3483',
  },

  // ПРИКЛЮЧЕНИЯ
  {
    id: 'gold-adv-1',
    title: 'Граф Монте-Кристо',
    author: 'Александр Дюма',
    genres: ['Приключения', 'Классика', 'Драма'],
    matchScore: 98,
    reason: 'Величайший авантюрный роман о верности, предательстве и неотвратимости возмездия.',
    description: 'Эдмон Дантес несправедливо заточен в замок Иф, совершает дерзкий побег и возвращается сказочно богатым мстителем.',
    estimatedPages: 1248,
    keyThemes: ['Месть', 'Надежда', 'Справедливость'],
    coverColor: '#78281F',
  },
  {
    id: 'gold-adv-2',
    title: 'Остров сокровищ',
    author: 'Роберт Льюис Стивенсон',
    genres: ['Приключения', 'Классика', 'Пираты'],
    matchScore: 96,
    reason: 'Золотой стандарт пиратской романтики, мужества и поиска легендарного клада.',
    description: 'Юный Джим Хокинс с картой капитана Флинта отправляется в опасное плавание навстречу пиратам Джона Сильвера.',
    estimatedPages: 256,
    keyThemes: ['Клад', 'Отвага', 'Пираты'],
    coverColor: '#B7950B',
  },
  {
    id: 'gold-adv-3',
    title: 'Два капитана',
    author: 'Вениамин Каверин',
    genres: ['Приключения', 'Роман', 'Классика'],
    matchScore: 97,
    reason: 'Легендарный девиз: «Бороться и искать, найти и не сдаваться!». Книга о чести и верности.',
    description: 'Саня Григорьев посвящает жизнь разгадке гибели полярной экспедиции капитана Татаринова.',
    estimatedPages: 720,
    keyThemes: ['Честь', 'Поиск', 'Любовь'],
    coverColor: '#1B4F72',
  },

  // ДРАМА И РОМАНТИКА
  {
    id: 'gold-dra-1',
    title: 'Гордость и предубеждение',
    author: 'Джейн Остин',
    genres: ['Драма', 'Классика', 'Романтика'],
    matchScore: 98,
    reason: 'Искрометное остроумие, тончайшая психологическая наблюдательность и история настоящей любви.',
    description: 'Элизабет Беннет и мистер Дарси должны преодолеть взаимные предрассудки и гордость ради счастья.',
    estimatedPages: 416,
    keyThemes: ['Любовь', 'Характер', 'Ирония'],
    coverColor: '#641E16',
  },
  {
    id: 'gold-dra-2',
    title: 'Великий Гэтсби',
    author: 'Фрэнсис Скотт Фицджеральд',
    genres: ['Драма', 'Классика', 'Романтика'],
    matchScore: 97,
    reason: 'Ослепительная и щемящая хроника эпохи джаза о вечной недосягаемой мечте.',
    description: 'Таинственный миллионер Джей Гэтсби устраивает пышные вечеринки ради взгляда потерянной возлюбленной Дейзи.',
    estimatedPages: 224,
    keyThemes: ['Мечта', 'Иллюзия', 'Джаз'],
    coverColor: '#117A65',
  },
];

// Helper to generate curated fallback recommendations filtered by category and excluded titles
function getCuratedRecommendations(excludedTitles: string[], focusGenre?: string): RecommendedBookItem[] {
  const excludedSet = new Set(excludedTitles.map((t) => t.toLowerCase().trim()));
  
  // Filter out any excluded books
  let pool = CURATED_GOLD_LIBRARY.filter((b) => !excludedSet.has(b.title.toLowerCase().trim()));
  
  if (focusGenre && focusGenre !== 'all') {
    const genreLower = focusGenre.toLowerCase();
    const matching = pool.filter((b) => b.genres.some((g) => g.toLowerCase().includes(genreLower)));
    if (matching.length >= 10) {
      pool = matching;
    } else {
      // Prioritize matching first, then append other classics
      pool.sort((a, b) => {
        const aMatches = a.genres.some((g) => g.toLowerCase().includes(genreLower));
        const bMatches = b.genres.some((g) => g.toLowerCase().includes(genreLower));
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
        return b.matchScore - a.matchScore;
      });
    }
  }

  return pool.slice(0, 20);
}

// AI Book Recommendations API endpoint (Supports both GET and POST)
app.all('/api/recommendations', async (req, res) => {
  if (req.method === 'GET') {
    return res.json({
      success: true,
      message: 'AI Recommendations endpoint is healthy. Send a POST request with reader shelf data to receive recommendations.',
      sampleCount: CURATED_GOLD_LIBRARY.length,
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed. Please use POST to request recommendations.',
    });
  }

  const { books, focusGenre, mood, excludedTitles } = (req.body || {}) as {
    books?: BookInput[];
    focusGenre?: string;
    mood?: string;
    excludedTitles?: string[];
  };

  const userBooks = Array.isArray(books) ? books : [];
  const libraryTitles = userBooks.map((b) => (b.title || '').toLowerCase().trim()).filter(Boolean);
  const dismissedTitles = Array.isArray(excludedTitles) ? excludedTitles.map((t) => (t || '').toLowerCase().trim()).filter(Boolean) : [];
  const allExcluded = Array.from(new Set([...libraryTitles, ...dismissedTitles]));

  try {
    // Construct rich reader profile
    const completedBooks = userBooks.filter((b) => b.status === 'completed' || (b.rating && b.rating > 0));
    const highRatedBooks = userBooks.filter((b) => b.rating && b.rating >= 8);

    let profileSummary = '';
    if (completedBooks.length > 0) {
      profileSummary += 'ПРОЧИТАННЫЕ КНИГИ И ОЦЕНКИ ПОЛЬЗОВАТЕЛЯ:\n';
      completedBooks.slice(0, 30).forEach((b) => {
        const ratingStr = b.rating ? ` [Оценка: ${b.rating}/10★]` : '';
        const genresStr = b.genres?.length ? ` (Жанры: ${b.genres.join(', ')})` : '';
        profileSummary += `• «${b.title}» — ${b.authors?.join(', ') || 'Автор'}${ratingStr}${genresStr}\n`;
      });
    }

    if (highRatedBooks.length > 0) {
      profileSummary += '\nЛЮБИМЫЕ КНИГИ С ВЫСШИМ БАЛЛОМ (8-10★):\n';
      highRatedBooks.slice(0, 15).forEach((b) => {
        profileSummary += `★ «${b.title}» (${b.authors?.join(', ') || 'Автор'})\n`;
      });
    }

    let genreDirective = '';
    if (focusGenre && focusGenre !== 'all') {
      genreDirective = `\nЦЕЛЕВАЯ КАТЕГОРИЯ: «${focusGenre}».
СТРОГО ВСЕ 20 РЕКОМЕНДАЦИЙ ДОЛЖНЫ БЫТЬ ИЗ ЖАНРА / КАТЕГОРИИ «${focusGenre}» (или самых близких профильных поджанров)!\n`;
    }

    let moodStr = '';
    if (mood && mood !== 'all') {
      moodStr = `\nНастроение для чтения: ${mood}.\n`;
    }

    const prompt = `Ты — первоклассный литературный критик, эрудированный библиотекарь и рекомендательный алгоритм нового поколения.
Перед тобой профиль читателя и его личная библиотека:

${profileSummary || 'Библиотека читателя пока только формируется. Предложи золотой фонд выдающихся книг.'}
${genreDirective}${moodStr}

Сформируй персональный ТОП-20 книг, которые с наибольшей вероятностью понравятся этому читателю.

ПРАВИЛА И КРИТЕРИИ:
1. Выдай РОВНО 20 уникальных книг в порядке релевантности (от наивысшей совместимости к высокой).
${focusGenre && focusGenre !== 'all' ? `2. ВСЕ 20 книг должны строго соответствовать категории «${focusGenre}»!` : '2. Разнообразие: сочетай признанную классику, современные интеллектуальные бестселлеры и жанровые шедевры.'}
3. СТРОГО НЕ ВКЛЮЧАЙ книги, которые УЖЕ прочитаны читателем или помечены им как "Не рекомендовать" (исключить названия: ${allExcluded.join(', ') || 'нет'}).
4. Персонализация: обоснование ("reason") должно четко и понятно объяснять, почему книга подойдет именно этому читателю с отсылкой к его вкусу, авторам или темам.
5. Для каждой книги подбери благородный hex-код переплета для обложки ("coverColor"), подходящий атмосфере книги.

Формат ответа: СТРОГО валидный JSON-массив из 20 объектов со следующими ключами:
[
  {
    "id": "rec-1",
    "title": "Название книги на русском языке",
    "author": "Имя Фамилия автора",
    "genres": ["Основной жанр", "Дополнительный жанр"],
    "matchScore": 98,
    "reason": "Персональная причина рекомендации для этого читателя (1-2 емких предложения)",
    "description": "Краткая интригующая аннотация сюжета и ключевых тем (2 предложения)",
    "estimatedPages": 450,
    "keyThemes": ["Тема1", "Тема2", "Тема3"],
    "coverColor": "#2C3E50"
  }
]`;

    // Fast generation using gemini-3.1-flash-lite
    let response: any = null;
    try {
      const callPromise = ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI generation timeout after 10s')), 10000)
      );

      response = await Promise.race([callPromise, timeoutPromise]);
    } catch (apiErr: any) {
      console.warn('Gemini call error or timeout, activating curated literary engine:', apiErr?.message);
    }

    let recommendations: any[] = [];
    if (response && response.text) {
      const responseText = response.text.trim();
      try {
        recommendations = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            recommendations = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.error('Failed to parse regex-extracted JSON:', e);
          }
        }
      }
    }

    // If Gemini failed or returned empty, seamlessly provide curated recommendations
    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      console.info('Serving curated literary recommendations fallback for genre:', focusGenre);
      recommendations = getCuratedRecommendations(allExcluded, focusGenre);
    }

    // Ensure valid IDs and normalized structures, and double-check excluded titles
    const normalized = recommendations
      .filter((item: any) => {
        const title = String(item.title || '').toLowerCase().trim();
        return title && !allExcluded.includes(title);
      })
      .map((item: any, idx: number) => ({
        id: item.id || `rec-${Date.now()}-${idx + 1}`,
        title: String(item.title || 'Рекомендуемая книга'),
        author: String(item.author || 'Автор'),
        genres: Array.isArray(item.genres) && item.genres.length > 0 ? item.genres : [focusGenre && focusGenre !== 'all' ? focusGenre : 'Художественная литература'],
        matchScore: typeof item.matchScore === 'number' ? Math.min(99, Math.max(70, Math.round(item.matchScore))) : Math.max(75, 96 - idx),
        reason: String(item.reason || 'Отлично подходит под ваши читательские вкусы и предпочтения.'),
        description: String(item.description || 'Увлекательное литературное произведение с глубоким смыслом.'),
        estimatedPages: typeof item.estimatedPages === 'number' ? item.estimatedPages : 380,
        keyThemes: Array.isArray(item.keyThemes) && item.keyThemes.length > 0 ? item.keyThemes : ['Литература'],
        coverColor: typeof item.coverColor === 'string' && item.coverColor.startsWith('#') ? item.coverColor : '#2C3E50',
      }));

    return res.json({
      success: true,
      category: focusGenre || 'all',
      count: normalized.length,
      recommendations: normalized,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('AI Recommendations API error:', error);
    const fallbackList = getCuratedRecommendations(allExcluded, focusGenre);
    return res.json({
      success: true,
      isFallback: true,
      category: focusGenre || 'all',
      count: fallbackList.length,
      recommendations: fallbackList,
      generatedAt: new Date().toISOString(),
    });
  }
});

// Setup Vite in development or serve static in production
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server is running at http://${HOST}:${PORT} [${isProd ? 'production' : 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
