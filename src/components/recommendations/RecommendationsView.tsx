import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Book } from '../../types/book';
import { TOP20_BY_CATEGORY, getTop20ForCategory, CuratedBook } from '../../data/curatedTop20';
import { 
  Sparkles, 
  BookOpen, 
  Plus, 
  Check, 
  RefreshCw, 
  Search, 
  SlidersHorizontal, 
  Star, 
  Compass, 
  Lock, 
  Cloud, 
  Bookmark, 
  ExternalLink,
  Flame,
  X,
  BookMarked,
  EyeOff,
  RotateCcw,
  Trash2,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2
} from 'lucide-react';

export interface RecommendedBook {
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
  isWishlist?: boolean;
}

export interface DismissedBook {
  title: string;
  author: string;
  dismissedAt: string;
  category?: string;
}

interface RecommendationsViewProps {
  books: Book[];
  currentUser?: User | any | null;
  onOpenAuthModal?: () => void;
  onAddBookToLibrary: (newBook: Partial<Book>) => Promise<void>;
  onSelectBook?: (book: Book) => void;
  genresList?: string[];
}

// Preset primary categories with distinctive icons
export interface CategoryTab {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

const PRESET_CATEGORIES: CategoryTab[] = [
  { id: 'all', label: 'Главный ТОП-20', icon: '✨', badge: 'Золотой микс' },
  { id: 'Фантастика', label: 'Фантастика', icon: '🚀' },
  { id: 'Фэнтези', label: 'Фэнтези', icon: '🐉' },
  { id: 'Классика', label: 'Классика', icon: '🏛️' },
  { id: 'Детектив', label: 'Детективы', icon: '🔍' },
  { id: 'Антиутопия', label: 'Антиутопия', icon: '👁️' },
  { id: 'Психология', label: 'Психология', icon: '🧠' },
  { id: 'Нон-фикшн', label: 'Нон-фикшн', icon: '📚' },
  { id: 'Приключения', label: 'Приключения', icon: '🗺️' },
  { id: 'Драма', label: 'Драма и Роман', icon: '🎭' },
];

const READING_MOODS = [
  { id: 'all', label: 'Любое настроение' },
  { id: 'Интеллектуальное и глубокое', label: '🧠 Глубокое' },
  { id: 'Захватывающее и динамичное', label: '⚡ Динамичное' },
  { id: 'Философское и созерцательное', label: '🌿 Философское' },
  { id: 'Тёмное, таинственное и напряжённое', label: '🕵️ Тёмное / Нуар' },
  { id: 'Вдохновляющее и жизнеутверждающее', label: '✨ Вдохновляющее' },
];

// Rich curated gold library for instant display and offline fallback across categories
const CLIENT_GOLD_LIBRARY: RecommendedBook[] = [
  // АНТИУТОПИЯ
  {
    id: 'client-anti-1',
    title: '1984',
    author: 'Джордж Оруэлл',
    genres: ['Антиутопия', 'Фантастика', 'Классика'],
    matchScore: 98,
    reason: 'Глубокое исследование природы власти, свободы слова и индивидуальности.',
    description: 'Мир Океании под контролем Старшего Брата, где бунт начинается с запретного дневника.',
    estimatedPages: 320,
    keyThemes: ['Свобода', 'Правда', 'Бунт'],
    coverColor: '#2C3E50',
  },
  {
    id: 'client-anti-2',
    title: 'О дивный новый мир',
    author: 'Олдос Хаксли',
    genres: ['Антиутопия', 'Фантастика', 'Философия'],
    matchScore: 97,
    reason: 'Блестящее визионерское предупреждение о ловушках стандартизированного потребления.',
    description: 'Идеальный механизированный мир, где стандартизировано всё — вплоть до человеческих эмоций.',
    estimatedPages: 288,
    keyThemes: ['Индивидуальность', 'Технологии', 'Смысл жизни'],
    coverColor: '#1B4965',
  },
  {
    id: 'client-anti-3',
    title: 'Мы',
    author: 'Евгений Замятин',
    genres: ['Антиутопия', 'Фантастика', 'Классика'],
    matchScore: 96,
    reason: 'Краеугольный камень мировой антиутопии, написанный выразительным экспрессивным языком.',
    description: 'Строитель космического корабля «Интеграл» неожиданно для себя обнаруживает в душе зарождение любви.',
    estimatedPages: 224,
    keyThemes: ['Логика', 'Чувства', 'Свобода'],
    coverColor: '#34495E',
  },
  {
    id: 'client-anti-4',
    title: '451° по Фаренгейту',
    author: 'Рэй Брэдбери',
    genres: ['Антиутопия', 'Фантастика', 'Философия'],
    matchScore: 96,
    reason: 'Вдохновенная ода книгам, живому человеческому общению и памяти поколений.',
    description: 'Гай Монтэг прозревает и решает спасти крупицы всемирной мудрости от сожжения.',
    estimatedPages: 256,
    keyThemes: ['Книги', 'Память', 'Пробуждение'],
    coverColor: '#873600',
  },
  {
    id: 'client-anti-5',
    title: 'Скотный двор',
    author: 'Джордж Оруэлл',
    genres: ['Антиутопия', 'Сатира', 'Классика'],
    matchScore: 95,
    reason: 'Остроумная сатирическая притча о перерождении революционных идеалов в диктатуру.',
    description: 'Ферма животных объявляет свободу от людей, пока свиньи постепенно не присваивают себе абсолютную власть.',
    estimatedPages: 140,
    keyThemes: ['Власть', 'Идеология', 'Равенство'],
    coverColor: '#5B2C6F',
  },

  // ФАНТАСТИКА
  {
    id: 'client-sci-1',
    title: 'Дюна',
    author: 'Фрэнк Герберт',
    genres: ['Фантастика', 'Космоопера', 'Приключения'],
    matchScore: 99,
    reason: 'Эпическая сага об Арракисе, геополитике будущего и бремени избранности.',
    description: 'Юный Пол Атрейдес оказывается в центре борьбы за контроль над источником пряности во Вселенной.',
    estimatedPages: 704,
    keyThemes: ['Власть', 'Экология', 'Судьба'],
    coverColor: '#C47335',
  },
  {
    id: 'client-sci-2',
    title: 'Цветы для Элджернона',
    author: 'Дэниел Киз',
    genres: ['Фантастика', 'Психология', 'Драма'],
    matchScore: 98,
    reason: 'Эмоционально мощная история о ценности доброты и человеческого сердца над чистым разумом.',
    description: 'Чарли Гордон проходит через уникальный эксперимент, заставляющий переосмыслить человеческие отношения.',
    estimatedPages: 320,
    keyThemes: ['Интеллект', 'Сочувствие', 'Одиночество'],
    coverColor: '#5C3D2E',
  },
  {
    id: 'client-sci-3',
    title: 'Солярис',
    author: 'Станислав Лем',
    genres: ['Фантастика', 'Философия', 'Детектив'],
    matchScore: 97,
    reason: 'Глубочайшее философское исследование границ человеческого познания.',
    description: 'Исследовательская станция над мыслящим Океаном планеты Солярис сталкивается с материализацией сокровенных воспоминаний.',
    estimatedPages: 288,
    keyThemes: ['Контакт', 'Память', 'Совесть'],
    coverColor: '#1A5276',
  },
  {
    id: 'client-sci-4',
    title: 'Гиперион',
    author: 'Дэн Симмонс',
    genres: ['Фантастика', 'Космоопера', 'Философия'],
    matchScore: 96,
    reason: 'Грандиозный космический роман о загадочном существе Шрайке и судьбах семи паломников.',
    description: 'В канун галактической войны семеро избранных делятся своими сокровенными историями на пути к Гробницам Времени.',
    estimatedPages: 560,
    keyThemes: ['Время', 'Судьба', 'Бог и человек'],
    coverColor: '#4A235A',
  },
  {
    id: 'client-sci-5',
    title: 'Пикник на обочине',
    author: 'Аркадий и Борис Стругацкие',
    genres: ['Фантастика', 'Приключения', 'Философия'],
    matchScore: 98,
    reason: 'Культовое произведение о таинственной Зоне и самом сокровенном человеческом желании.',
    description: 'Сталкер Рэдрик Шухарт ищет в Зоне Золотой шар: «Счастье для всех, даром, и пусть никто не уйдет обиженным!».',
    estimatedPages: 240,
    keyThemes: ['Судьба', 'Мечта', 'Выбор'],
    coverColor: '#212F3D',
  },
  {
    id: 'client-sci-6',
    title: 'Задача трех тел',
    author: 'Лю Цысинь',
    genres: ['Фантастика', 'Наука', 'Триллер'],
    matchScore: 95,
    reason: 'Масштабная современная сай-фай сага о контакте с чуждым внеземным разумом.',
    description: 'Сигнал из Китая эпохи Культурной революции пробуждает интерес цивилизации Трисоляриса к Земле.',
    estimatedPages: 464,
    keyThemes: ['Космос', 'Наука', 'Выживание'],
    coverColor: '#196F3D',
  },

  // КЛАССИКА
  {
    id: 'client-class-1',
    title: 'Мастер и Маргарита',
    author: 'Михаил Булгаков',
    genres: ['Классика', 'Мистика', 'Философия'],
    matchScore: 99,
    reason: 'Непревзойденный шедевр мировой литературы о любви, преданности и воздаянии.',
    description: 'В Москве появляется свита Воланда, раскрывая тайные пороки горожан и возвеличивая верность.',
    estimatedPages: 480,
    keyThemes: ['Истина', 'Любовь', 'Справедливость'],
    coverColor: '#4A1521',
  },
  {
    id: 'client-class-2',
    title: 'Преступление и наказание',
    author: 'Фёдор Достоевский',
    genres: ['Классика', 'Психология', 'Философия'],
    matchScore: 98,
    reason: 'Грандиозный психологический роман об испытании совести и спасительной силе любви.',
    description: 'Раскольников решается переступить черту, но бремя содеянного оказывается тяжелее любых теорий.',
    estimatedPages: 576,
    keyThemes: ['Совесть', 'Гордыня', 'Искупление'],
    coverColor: '#1C2833',
  },
  {
    id: 'client-class-3',
    title: 'Сто лет одиночества',
    author: 'Габриэль Гарсиа Маркес',
    genres: ['Классика', 'Магический реализм', 'Драма'],
    matchScore: 96,
    reason: 'Поэтичный и завораживающий эпос о бесконечном круговороте человеческих страстей.',
    description: 'Хроника семи поколений семьи Буэндиа в мифическом городке Макондо.',
    estimatedPages: 480,
    keyThemes: ['Семья', 'Одиночество', 'Время'],
    coverColor: '#B07D62',
  },
  {
    id: 'client-class-4',
    title: 'Мартин Иден',
    author: 'Джек Лондон',
    genres: ['Классика', 'Драма', 'Биография'],
    matchScore: 95,
    reason: 'Мощнейшая история железного упорства, самообразования и цены успеха.',
    description: 'Матрос поднимается из низов общества к вершинам литературного олимпа ради любви.',
    estimatedPages: 448,
    keyThemes: ['Труд', 'Воля', 'Разочарование'],
    coverColor: '#512E5F',
  },
  {
    id: 'client-class-5',
    title: 'Три товарища',
    author: 'Эрих Мария Ремарк',
    genres: ['Классика', 'Драма', 'Романтика'],
    matchScore: 97,
    reason: 'Пронзительный роман о неподдельной дружбе и хрупком счастье.',
    description: 'История трех фронтовых друзей и трогательной любви Роберта и Пат в межвоенной Германии.',
    estimatedPages: 480,
    keyThemes: ['Дружба', 'Любовь', 'Жизнь'],
    coverColor: '#145A32',
  },
  {
    id: 'client-class-6',
    title: 'Убить пересмешника',
    author: 'Харпер Ли',
    genres: ['Классика', 'Драма', 'Воспитание'],
    matchScore: 95,
    reason: 'Трогательный роман о воспитании чести, совести и защите невинных.',
    description: 'Аттикус Финч берется защищать оклеветанного человека, подавая пример своим детям.',
    estimatedPages: 416,
    keyThemes: ['Справедливость', 'Честность', 'Детство'],
    coverColor: '#2B580C',
  },

  // ДЕТЕКТИВ И ТРИЛЛЕР
  {
    id: 'client-det-1',
    title: 'Десять негритят',
    author: 'Агата Кристи',
    genres: ['Детектив', 'Триллер', 'Классика'],
    matchScore: 98,
    reason: 'Эталон классического герметичного детектива с совершенной интригой.',
    description: 'Десять человек на уединенном Негритянском острове караются неизвестным судьей.',
    estimatedPages: 256,
    keyThemes: ['Тайна', 'Возмездие', 'Суд'],
    coverColor: '#34495E',
  },
  {
    id: 'client-det-2',
    title: 'Собака Баскервилей',
    author: 'Артур Конан Дойл',
    genres: ['Детектив', 'Приключения', 'Мистика'],
    matchScore: 97,
    reason: 'Легендарное приключение Шерлока Холмса и доктора Ватсона на мрачных болотах Дартмура.',
    description: 'Сыщик расследует проклятие древнего рода Баскервилей и появление гигантского призрачного пса.',
    estimatedPages: 220,
    keyThemes: ['Дедукция', 'Логика', 'Тайна'],
    coverColor: '#1B2631',
  },
  {
    id: 'client-det-3',
    title: 'Девушка с татуировкой дракона',
    author: 'Стиг Ларссон',
    genres: ['Детектив', 'Триллер', 'Криминал'],
    matchScore: 96,
    reason: 'Захватывающий северный детектив с харизматичными детективами-бунтарями.',
    description: 'Журналист и гениальная хакерша раскрывают зловещие секреты влиятельного шведского промышленного клана.',
    estimatedPages: 624,
    keyThemes: ['Следствие', 'Семья', 'Правда'],
    coverColor: '#17202A',
  },
  {
    id: 'client-det-4',
    title: 'Молчание ягнят',
    author: 'Томас Харрис',
    genres: ['Детектив', 'Триллер', 'Психология'],
    matchScore: 96,
    reason: 'Интеллектуальная дуэль между молодым агентом ФБР и блестящим каннибалом-психиатром.',
    description: 'Кларисса Старлинг ищет опасного маньяка, прибегая к пугающим консультациям доктора Ганнибала Лектера.',
    estimatedPages: 384,
    keyThemes: ['Психология', 'Интеллект', 'Страх'],
    coverColor: '#78281F',
  },
  {
    id: 'client-det-5',
    title: 'Имя розы',
    author: 'Умберто Эко',
    genres: ['Детектив', 'История', 'Философия'],
    matchScore: 97,
    reason: 'Грандиозный детектив в средневековом монастыре о власти книг и поиске истины.',
    description: 'Вильгельм Баскервильский расследует загадочные смерти монахов вокруг тайной лабиринтной библиотеки.',
    estimatedPages: 672,
    keyThemes: ['Знание', 'Истина', 'Средневековье'],
    coverColor: '#4A235A',
  },

  // ФЭНТЕЗИ
  {
    id: 'client-fan-1',
    title: 'Властелин Колец',
    author: 'Дж. Р. Р. Толкин',
    genres: ['Фэнтези', 'Эпос', 'Приключения'],
    matchScore: 99,
    reason: 'Величайший фэнтези-эпос всех времен о мужестве, братстве и преодолении тьмы.',
    description: 'Маленький хоббит Фродо несет Кольцо Всевластья в самое сердце Мордора, чтобы спасти мир.',
    estimatedPages: 1120,
    keyThemes: ['Дружба', 'Надежда', 'Свет против тьмы'],
    coverColor: '#145A32',
  },
  {
    id: 'client-fan-2',
    title: 'Ведьмак. Последнее желание',
    author: 'Анджей Сапковский',
    genres: ['Фэнтези', 'Приключения', 'Мифология'],
    matchScore: 97,
    reason: 'Атмосферное темное фэнтези со славянским колоритом, остроумием и моральными дилеммами.',
    description: 'Геральт из Ривии охотится на монстров в мире, где люди часто оказываются куда безжалостнее чудовищ.',
    estimatedPages: 384,
    keyThemes: ['Меньшее зло', 'Судьба', 'Ирония'],
    coverColor: '#283747',
  },
  {
    id: 'client-fan-3',
    title: 'Имя ветра',
    author: 'Патрик Ротфусс',
    genres: ['Фэнтези', 'Магия', 'Приключения'],
    matchScore: 96,
    reason: 'Поэтичный и завораживающий рассказ легендарного мага о своей юности и тайнах Вселенной.',
    description: 'Квоут вспоминает годы нищеты, учебу в Университете магии и поиски загадочных демонических чандриан.',
    estimatedPages: 672,
    keyThemes: ['Музыка', 'Имена', 'Легенда'],
    coverColor: '#0E6251',
  },
  {
    id: 'client-fan-4',
    title: 'Гарри Поттер и узник Азкабана',
    author: 'Дж. К. Роулинг',
    genres: ['Фэнтези', 'Приключения', 'Магия'],
    matchScore: 96,
    reason: 'Самая взрослая и глубокая книга первой части саги о Хогвартсе и правде прошлого.',
    description: 'Бегство Сириуса Блэка из тюрьмы Азкабан и появление стражей-дементоров открывают тайну родителей Гарри.',
    estimatedPages: 448,
    keyThemes: ['Дружба', 'Патронус', 'Семья'],
    coverColor: '#78281F',
  },

  // ПСИХОЛОГИЯ И САМОРАЗВИТИЕ
  {
    id: 'client-psy-1',
    title: 'Сказать жизни «Да!»: Психолог в концлагере',
    author: 'Виктор Франкл',
    genres: ['Психология', 'Философия', 'Биография'],
    matchScore: 99,
    reason: 'Великая книга о нахождении истинного жизненного смысла даже в самых суровых испытаниях.',
    description: 'Основатель логотерапии доказывает, что стремление к смыслу — главная движущая сила человека.',
    estimatedPages: 240,
    keyThemes: ['Смысл', 'Стойкость', 'Внутренняя свобода'],
    coverColor: '#1B4F72',
  },
  {
    id: 'client-psy-2',
    title: 'Думай медленно... решай быстро',
    author: 'Даниэль Канеман',
    genres: ['Психология', 'Наука', 'Нон-фикшн'],
    matchScore: 98,
    reason: 'Фундаментальный труд нобелевского лауреата об иллюзиях и ловушках человеческого мозга.',
    description: 'Как быстрое интуитивное и медленное рациональное мышление влияют на наши жизненные решения.',
    estimatedPages: 656,
    keyThemes: ['Интеллект', 'Логика', 'Ошибки мышления'],
    coverColor: '#196F3D',
  },
  {
    id: 'client-psy-3',
    title: 'Поток: Психология оптимального переживания',
    author: 'Михай Чиксентмихайи',
    genres: ['Психология', 'Саморазвитие', 'Философия'],
    matchScore: 96,
    reason: 'Глубокий анализ состояния полной увлеченности и гармонии в труде и творчестве.',
    description: 'Как подчинить внимание и превратить повседневную жизнь в источник непрерывного вдохновения.',
    estimatedPages: 464,
    keyThemes: ['Поток', 'Счастье', 'Фокус'],
    coverColor: '#0E6655',
  },
  {
    id: 'client-psy-4',
    title: 'Атомные привычки',
    author: 'Джеймс Клир',
    genres: ['Психология', 'Саморазвитие', 'Нон-фикшн'],
    matchScore: 95,
    reason: 'Практическая система маленьких регулярных шагов, приводящих к выдающимся результатам.',
    description: 'Как небольшие ежедневные корректировки в поведении кардинально меняют траекторию жизни.',
    estimatedPages: 320,
    keyThemes: ['Привычки', 'Дисциплина', 'Результат'],
    coverColor: '#D35400',
  },

  // НОН-ФИКШН И НАУКА
  {
    id: 'client-non-1',
    title: 'Sapiens. Краткая история человечества',
    author: 'Юваль Ной Харари',
    genres: ['Нон-фикшн', 'История', 'Наука'],
    matchScore: 98,
    reason: 'Захватывающий панорамный анализ того, как вера в общие мифы сделала человека царем природы.',
    description: 'Когнитивная, аграрная и научная революции: как человечество прошло путь от приматов к созданию ИИ.',
    estimatedPages: 512,
    keyThemes: ['Эволюция', 'Общество', 'Будущее'],
    coverColor: '#1E8449',
  },
  {
    id: 'client-non-2',
    title: 'Краткая история времени',
    author: 'Стивен Хокинг',
    genres: ['Нон-фикшн', 'Наука', 'Астрофизика'],
    matchScore: 97,
    reason: 'Увлекательное и простое погружение в тайны квантовой механики, гравитации и черных дыр.',
    description: 'Путешествие к истокам зарождения Вселенной под руководством одного из величайших астрофизиков.',
    estimatedPages: 272,
    keyThemes: ['Космос', 'Черные дыры', 'Время'],
    coverColor: '#17202A',
  },

  // ПРИКЛЮЧЕНИЯ
  {
    id: 'client-adv-1',
    title: 'Граф Монте-Кристо',
    author: 'Александр Дюма',
    genres: ['Приключения', 'Классика', 'Драма'],
    matchScore: 98,
    reason: 'Непревзойденный шедевр авантюрной литературы о верности, предательстве и возмездии.',
    description: 'Эдмон Дантес совершает побег из замка Иф и возвращается богатейшим графом, чтобы наказать врагов.',
    estimatedPages: 1248,
    keyThemes: ['Месть', 'Надежда', 'Справедливость'],
    coverColor: '#78281F',
  },
  {
    id: 'client-adv-2',
    title: 'Остров сокровищ',
    author: 'Роберт Льюис Стивенсон',
    genres: ['Приключения', 'Классика', 'Пираты'],
    matchScore: 96,
    reason: 'Золотой стандарт морской романтики, мужества и поиска пиратских сокровищ.',
    description: 'Юный Джим Хокинс отправляется на шхуне «Испаньола» навстречу пиратам хитроумного Джона Сильвера.',
    estimatedPages: 256,
    keyThemes: ['Клад', 'Отвага', 'Пираты'],
    coverColor: '#B7950B',
  },

  // ДРАМА И РОМАНТИКА
  {
    id: 'client-dra-1',
    title: 'Гордость и предубеждение',
    author: 'Джейн Остин',
    genres: ['Драма', 'Классика', 'Романтика'],
    matchScore: 98,
    reason: 'Искрометное остроумие, тонкая психологическая наблюдательность и преодоление предрассудков.',
    description: 'История сложных взаимоотношений проницательной Элизабет Беннет и благородного мистера Дарси.',
    estimatedPages: 416,
    keyThemes: ['Любовь', 'Характер', 'Ирония'],
    coverColor: '#641E16',
  },
  {
    id: 'client-dra-2',
    title: 'Великий Гэтсби',
    author: 'Фрэнсис Скотт Фицджеральд',
    genres: ['Драма', 'Классика', 'Романтика'],
    matchScore: 97,
    reason: 'Ослепительная и пронзительная драма эпохи джаза о вечной недостижимой мечте.',
    description: 'Миллионер Джей Гэтсби бросает весь свой блеск и богатство к ногам потерянной возлюбленной Дейзи.',
    estimatedPages: 224,
    keyThemes: ['Мечта', 'Иллюзия', 'Джаз'],
    coverColor: '#117A65',
  },
];

// Strict keyword verification to guarantee category purity
export const STRICT_GENRE_KEYWORDS: Record<string, string[]> = {
  'Детектив': ['детектив', 'триллер', 'расследование', 'криминал', 'сыщик', 'убийств', 'саспенс', 'нуар', 'маньяк', 'холмса', 'пуаро', 'следствие'],
  'Антиутопия': ['антиутопи', 'тоталитар', 'дистопи', 'оруэлл', 'замятин', 'хаксли', 'брэдбери', 'бунт против системы', 'диктатур'],
  'Фантастика': ['фантастик', 'космос', 'киберпанк', 'сай-фай', 'sci-fi', 'нф', 'космоопера', 'робот', 'пришельц', 'будущее'],
  'Фэнтези': ['фэнтези', 'маги', 'дракон', 'эльф', 'меч', 'толкин', 'сапковск', 'хогвартс', 'заклинани', 'ведьмак'],
  'Классика': ['классик', 'роман', 'толстой', 'достоевск', 'булгаков', 'драма', 'повесть'],
  'Психология': ['психолог', 'саморазвит', 'мозг', 'привычк', 'поведени', 'эмоци', 'мышлени', 'психотерапи'],
  'Нон-фикшн': ['нон-фикшн', 'наука', 'биографи', 'истори', 'научпоп', 'документал', 'эволюци', 'факты'],
  'Приключения': ['приключен', 'путешеств', 'остров', 'пират', 'экспедици', 'море', 'робинзонада', 'клад'],
  'Драма': ['драма', 'романтик', 'любов', 'чувств', 'трагеди', 'судьба', 'отношени'],
};

// Known cross-genre leaks to explicitly reject
export const GENRE_DISALLOWED_MAP: Record<string, string[]> = {
  'Детектив': ['дюна', 'властелин колец', 'мы', 'солярис', 'гиперион', 'хоббит', 'ведьмак', 'гарри поттер', '1984', 'о дивный новый мир', 'скотный двор'],
  'Антиутопия': ['дюна', 'властелин колец', 'ведьмак', 'гарри поттер', 'дерево', 'хоббит', 'десять негритят', 'собака баскервилей'],
  'Фэнтези': ['дюна', '1984', 'мы', 'солярис', 'десять негритят', 'собака баскервилей', 'нейромант', 'sapiens'],
  'Фантастика': ['властелин колец', 'хоббит', 'ведьмак', 'гарри поттер', 'десять негритят', 'гордость и предубеждение'],
};

// Helper: strictly verify if a book belongs to the selected category
export function isBookMatchingCategory(
  book: { title: string; genres?: string[]; authors?: string[] },
  category: string
): boolean {
  if (!category || category === 'all') return true;
  const titleLower = (book.title || '').toLowerCase().trim();
  const disallowed = GENRE_DISALLOWED_MAP[category] || [];
  if (disallowed.some((bad) => titleLower.includes(bad))) {
    return false;
  }

  // 1. Is title directly present in curated Top 20 for this category?
  const curated = TOP20_BY_CATEGORY[category] || [];
  if (curated.some((c) => c.title.toLowerCase().trim() === titleLower)) {
    return true;
  }

  // 2. Do genres match the category name or keywords?
  const keywords = STRICT_GENRE_KEYWORDS[category] || [category.toLowerCase()];
  const bookGenres = (book.genres || []).map((g) => g.toLowerCase());
  if (bookGenres.some((g) => keywords.some((k) => g.includes(k)))) {
    return true;
  }

  return false;
}

// High-precision recommendations generator with strict category isolation and wishlist prioritization
export function getClientCategoryRecommendations(
  userBooks: Book[],
  dismissedTitles: string[],
  focusCategory: string
): RecommendedBook[] {
  // Exclude completed books and dismissed books
  const completedTitles = userBooks
    .filter((b) => b.status === 'completed')
    .map((b) => b.title.toLowerCase().trim());
  const allExcluded = Array.from(new Set([...completedTitles, ...dismissedTitles]));
  const excludedSet = new Set(allExcluded);

  const result: RecommendedBook[] = [];
  const addedTitles = new Set<string>();

  // 1. FIRST: Find books from USER'S WISHLIST (status === 'planned') that match this category!
  const userWishlist = userBooks.filter((b) => b.status === 'planned');
  const matchingWishlist = userWishlist.filter((b) => {
    const t = b.title.toLowerCase().trim();
    if (excludedSet.has(t)) return false;
    return isBookMatchingCategory(b, focusCategory);
  });

  // Prepend matching wishlist books with 99% match and wishlist badge
  matchingWishlist.forEach((wb, idx) => {
    const t = wb.title.toLowerCase().trim();
    if (!addedTitles.has(t)) {
      addedTitles.add(t);
      result.push({
        id: wb.id || `wish-${idx}`,
        title: wb.title,
        author: (wb.authors && wb.authors.length > 0) ? wb.authors.join(', ') : 'Автор',
        genres: wb.genres && wb.genres.length > 0 ? wb.genres : [focusCategory === 'all' ? 'Избранное' : focusCategory],
        matchScore: 99,
        reason: `🎯 Из вашего виш-листа! Вы запланировали эту книгу — рекомендуем взяться за неё в категории «${focusCategory === 'all' ? 'Главный ТОП-20' : focusCategory}».`,
        description: wb.notes ? `Ваша заметка: «${wb.notes}»` : 'Книга из вашего персонального списка «Хочу прочитать». Наивысший приоритет к чтению.',
        estimatedPages: wb.pages || 350,
        keyThemes: wb.genres && wb.genres.length > 0 ? wb.genres : ['Виш-лист', 'В планах'],
        coverColor: wb.coverColor || '#8A5A36',
        isWishlist: true,
      });
    }
  });

  // 2. SECOND: Fill remaining slots up to 20 strictly from the curated Top-20 for this category!
  const curatedList = getTop20ForCategory(focusCategory, allExcluded);
  curatedList.forEach((item) => {
    if (result.length >= 20) return;
    const t = item.title.toLowerCase().trim();
    if (!addedTitles.has(t) && !excludedSet.has(t)) {
      addedTitles.add(t);
      result.push({
        id: item.id || `client-${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        title: item.title,
        author: item.author,
        genres: item.genres,
        matchScore: Math.max(75, 98 - result.length),
        reason: item.reason,
        description: item.description,
        estimatedPages: item.estimatedPages,
        keyThemes: item.keyThemes,
        coverColor: item.coverColor,
        isWishlist: false,
      });
    }
  });

  return result.slice(0, 20);
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  books,
  currentUser,
  onOpenAuthModal,
  onAddBookToLibrary,
  onSelectBook,
  genresList = [],
}) => {
  // Active Category Selection
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Independent TOP-20 recommendations per category: Record<categoryKey, books[]>
  const [recommendationsByCategory, setRecommendationsByCategory] = useState<Record<string, RecommendedBook[]>>({});
  const [lastGeneratedByCategory, setLastGeneratedByCategory] = useState<Record<string, string>>({});
  
  // Dismissed books ("Не рекомендовать")
  const [dismissedBooks, setDismissedBooks] = useState<DismissedBook[]>([]);
  const [isDismissedModalOpen, setIsDismissedModalOpen] = useState(false);
  const [lastDismissedNotice, setLastDismissedNotice] = useState<{ title: string; timer?: any } | null>(null);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick action states
  const [addedBookTitles, setAddedBookTitles] = useState<Set<string>>(new Set());
  const [addingTitle, setAddingTitle] = useState<string | null>(null);

  // Detailed inspect modal
  const [inspectedBook, setInspectedBook] = useState<RecommendedBook | null>(null);

  // Storage key prefix per user session
  const userPrefix = useMemo(() => {
    return currentUser?.uid ? `uid_${currentUser.uid}` : 'guest';
  }, [currentUser]);

  const dismissedStorageKey = useMemo(() => {
    return `my_book_shelf_dismissed_recs_${userPrefix}`;
  }, [userPrefix]);

  const getCategoryStorageKey = useCallback((category: string) => {
    return `my_book_shelf_recs_v6_${category}_${userPrefix}`;
  }, [userPrefix]);

  // Combine preset categories + any custom genres from user library
  const availableCategories = useMemo<CategoryTab[]>(() => {
    const list: CategoryTab[] = [...PRESET_CATEGORIES];
    const existingIds = new Set(list.map((c) => c.id.toLowerCase()));

    genresList.forEach((genre) => {
      const trimmed = genre.trim();
      if (trimmed && !existingIds.has(trimmed.toLowerCase())) {
        existingIds.add(trimmed.toLowerCase());
        list.push({
          id: trimmed,
          label: trimmed,
          icon: '🏷️',
        });
      }
    });

    return list;
  }, [genresList]);

  // Load dismissed books on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(dismissedStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setDismissedBooks(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to parse dismissed books:', e);
      }
    }
  }, [dismissedStorageKey]);

  // Load cached recommendations for the selected category on tab switch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const catKey = getCategoryStorageKey(selectedCategory);
        const raw = localStorage.getItem(catKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
            // Guarantee category purity on cache retrieval
            const pureRecs = parsed.recommendations.filter((b: RecommendedBook) =>
              isBookMatchingCategory(b, selectedCategory)
            );
            if (pureRecs.length >= 15) {
              setRecommendationsByCategory((prev) => ({
                ...prev,
                [selectedCategory]: pureRecs,
              }));
              if (parsed.generatedAt) {
                setLastGeneratedByCategory((prev) => ({
                  ...prev,
                  [selectedCategory]: parsed.generatedAt,
                }));
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load category cache:', e);
      }
    }
  }, [selectedCategory, getCategoryStorageKey]);

  // Excluded titles set (dismissed books)
  const dismissedTitles = useMemo(() => {
    return dismissedBooks.map((b) => b.title.toLowerCase().trim());
  }, [dismissedBooks]);

  const dismissedTitlesSet = useMemo(() => {
    return new Set(dismissedTitles);
  }, [dismissedTitles]);

  const libraryTitlesSet = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => set.add(b.title.toLowerCase().trim()));
    return set;
  }, [books]);

  // User books divided by status
  const userWishlistMap = useMemo(() => {
    const map = new Map<string, Book>();
    books.forEach((b) => {
      if (b.status === 'planned') {
        map.set(b.title.toLowerCase().trim(), b);
      }
    });
    return map;
  }, [books]);

  const userCompletedTitles = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.status === 'completed') {
        set.add(b.title.toLowerCase().trim());
      }
    });
    return set;
  }, [books]);

  const userReadingTitles = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.status === 'reading') {
        set.add(b.title.toLowerCase().trim());
      }
    });
    return set;
  }, [books]);

  // Wishlist books matching the active category with strict genre verification
  const activeCategoryWishlistBooks = useMemo(() => {
    const wish = books.filter((b) => b.status === 'planned');
    return wish.filter((b) => isBookMatchingCategory(b, selectedCategory));
  }, [books, selectedCategory]);

  // Active recommendations for the currently selected category
  const rawCurrentCategoryRecs = useMemo(() => {
    const cached = recommendationsByCategory[selectedCategory];
    if (cached && cached.length > 0) {
      return cached;
    }
    // Instant fallback if not yet fetched
    return getClientCategoryRecommendations(books, dismissedTitles, selectedCategory);
  }, [recommendationsByCategory, selectedCategory, books, dismissedTitles]);

  // Filter out any dismissed book titles and apply search query
  const displayedRecommendations = useMemo(() => {
    return rawCurrentCategoryRecs.filter((item) => {
      // 1. Strictly exclude dismissed books
      if (dismissedTitlesSet.has(item.title.toLowerCase().trim())) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesAuthor = item.author.toLowerCase().includes(q);
        const matchesReason = item.reason.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesTheme = item.keyThemes.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesAuthor && !matchesReason && !matchesDesc && !matchesTheme) {
          return false;
        }
      }

      return true;
    });
  }, [rawCurrentCategoryRecs, dismissedTitlesSet, searchQuery]);

  // Generate / Refresh TOP-20 for the ACTIVE category
  const handleGenerateCategoryRecommendations = async (overrideMood?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    const activeMood = overrideMood !== undefined ? overrideMood : selectedMood;
    const catToFetch = selectedCategory;

    try {
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          books: books.map((b) => ({
            id: b.id,
            title: b.title,
            authors: b.authors,
            status: b.status,
            rating: b.rating,
            genres: b.genres,
            notes: b.notes,
            pages: b.pages,
          })),
          focusGenre: catToFetch,
          mood: activeMood,
          excludedTitles: dismissedTitles,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          const cleanList = data.recommendations.filter(
            (r: RecommendedBook) => !dismissedTitlesSet.has(r.title.toLowerCase().trim())
          );

          setRecommendationsByCategory((prev) => ({
            ...prev,
            [catToFetch]: cleanList,
          }));

          const now = data.generatedAt || new Date().toISOString();
          setLastGeneratedByCategory((prev) => ({
            ...prev,
            [catToFetch]: now,
          }));

          try {
            localStorage.setItem(
              getCategoryStorageKey(catToFetch),
              JSON.stringify({
                recommendations: cleanList,
                generatedAt: now,
                category: catToFetch,
              })
            );
          } catch {}
          return;
        }
      }

      // If server returned non-OK status, use client-side curated fallback
      console.warn('API returned non-OK, using curated category fallback');
      const fallbackList = getClientCategoryRecommendations(books, dismissedTitles, catToFetch);
      setRecommendationsByCategory((prev) => ({
        ...prev,
        [catToFetch]: fallbackList,
      }));
      const now = new Date().toISOString();
      setLastGeneratedByCategory((prev) => ({
        ...prev,
        [catToFetch]: now,
      }));
      try {
        localStorage.setItem(
          getCategoryStorageKey(catToFetch),
          JSON.stringify({
            recommendations: fallbackList,
            generatedAt: now,
            category: catToFetch,
          })
        );
      } catch {}
    } catch (err: any) {
      console.warn('Failed to fetch AI category recommendations, using fallback:', err);
      const fallbackList = getClientCategoryRecommendations(books, dismissedTitles, catToFetch);
      setRecommendationsByCategory((prev) => ({
        ...prev,
        [catToFetch]: fallbackList,
      }));
      const now = new Date().toISOString();
      setLastGeneratedByCategory((prev) => ({
        ...prev,
        [catToFetch]: now,
      }));
      try {
        localStorage.setItem(
          getCategoryStorageKey(catToFetch),
          JSON.stringify({
            recommendations: fallbackList,
            generatedAt: now,
            category: catToFetch,
          })
        );
      } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  // Action: "Не рекомендовать" (Dismiss book from recommendations)
  const handleDismissBook = (book: RecommendedBook, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const titleLower = book.title.toLowerCase().trim();
    if (dismissedTitlesSet.has(titleLower)) return;

    const newDismissed: DismissedBook = {
      title: book.title,
      author: book.author,
      dismissedAt: new Date().toISOString(),
      category: selectedCategory,
    };

    const updatedList = [newDismissed, ...dismissedBooks];
    setDismissedBooks(updatedList);

    // Save to localStorage
    try {
      localStorage.setItem(dismissedStorageKey, JSON.stringify(updatedList));
    } catch {}

    // Show temporary toast with Undo action
    setLastDismissedNotice({ title: book.title });
    setTimeout(() => {
      setLastDismissedNotice((curr) => (curr?.title === book.title ? null : curr));
    }, 5000);

    // If modal was open for this book, close it
    if (inspectedBook?.title === book.title) {
      setInspectedBook(null);
    }
  };

  // Undo dismissing a book
  const handleRestoreBook = (titleToRestore: string) => {
    const updated = dismissedBooks.filter(
      (b) => b.title.toLowerCase().trim() !== titleToRestore.toLowerCase().trim()
    );
    setDismissedBooks(updated);
    try {
      localStorage.setItem(dismissedStorageKey, JSON.stringify(updated));
    } catch {}
    setLastDismissedNotice(null);
  };

  // Clear all dismissed books
  const handleClearAllDismissed = () => {
    if (window.confirm('Восстановить все скрытые книги обратно в рекомендации?')) {
      setDismissedBooks([]);
      try {
        localStorage.removeItem(dismissedStorageKey);
      } catch {}
      setIsDismissedModalOpen(false);
    }
  };

  // Add recommended book or transition wishlist book with 1 click
  const handleQuickAdd = async (rec: RecommendedBook, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAddingTitle(rec.title);
    try {
      const existingWishlist = userWishlistMap.get(rec.title.toLowerCase().trim());
      await onAddBookToLibrary({
        id: existingWishlist ? existingWishlist.id : undefined,
        title: rec.title,
        authors: existingWishlist?.authors?.length ? existingWishlist.authors : [rec.author],
        status: 'reading',
        genres: rec.genres,
        pages: rec.estimatedPages,
        coverColor: rec.coverColor,
        startDate: new Date().toISOString().split('T')[0],
        notes: existingWishlist?.notes 
          ? `${existingWishlist.notes}\n[Начато из ТОП-20: ${selectedCategory === 'all' ? 'Главный' : selectedCategory}]`
          : `Рекомендовано в ТОП-20 [${selectedCategory === 'all' ? 'Главный' : selectedCategory}] (${rec.matchScore}% совпадение):\n${rec.reason}`,
      });
      setAddedBookTitles((prev) => new Set(prev).add(rec.title));
    } catch (err) {
      console.error('Failed to add book to library:', err);
    } finally {
      setAddingTitle(null);
    }
  };

  // 1-Click start reading a book from the user's wishlist spotlight
  const handleStartReadingWishlist = async (wb: Book, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAddingTitle(wb.title);
    try {
      await onAddBookToLibrary({
        id: wb.id,
        title: wb.title,
        authors: wb.authors,
        status: 'reading',
        genres: wb.genres,
        pages: wb.pages,
        coverColor: wb.coverColor,
        startDate: new Date().toISOString().split('T')[0],
      });
      setAddedBookTitles((prev) => new Set(prev).add(wb.title));
    } catch (err) {
      console.error('Failed to start reading wishlist book:', err);
    } finally {
      setAddingTitle(null);
    }
  };

  // Active category meta
  const activeCategoryMeta = useMemo(() => {
    return availableCategories.find((c) => c.id === selectedCategory) || {
      id: selectedCategory,
      label: selectedCategory,
      icon: '📖',
    };
  }, [availableCategories, selectedCategory]);

  const activeCategoryLastGen = lastGeneratedByCategory[selectedCategory];

  // Auth lock screen for unauthenticated visitors
  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#EFE9DF] flex items-center justify-center text-[#8A5A36] shadow-inner">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
          Персональные ИИ-рекомендации по категориям
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#6B6357] max-w-lg mx-auto leading-relaxed">
          Искусственный интеллект анализирует книги в вашей личной библиотеке, ваши оценки и предпочтения, чтобы формировать отдельный ТОП-20 для каждого литературного жанра.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <button
            onClick={onOpenAuthModal}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-[#FAF8F5] bg-[#24211D] rounded-md hover:bg-[#3B342C] transition-colors shadow-sm"
          >
            <Cloud className="w-4 h-4 text-[#EFE9DF]" />
            <span>Войти через Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D8]">
        <div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-[#8A5A36]" />
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-[#24211D]">
              Персональные рекомендации
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#6B6357]">
            Индивидуальный ТОП-20 для каждой категории на основе вашей полки и оценок
          </p>
        </div>

        {/* Action Buttons: Refresh Active Category + Dismissed Books Button */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {dismissedBooks.length > 0 && (
            <button
              onClick={() => setIsDismissedModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#7A7265] hover:text-[#24211D] bg-[#EFE9DF] hover:bg-[#E5DDCF] rounded-md transition-colors shadow-2xs"
              title="Список скрытых рекомендаций"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Скрытые ({dismissedBooks.length})</span>
            </button>
          )}

          <button
            onClick={() => handleGenerateCategoryRecommendations()}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md shadow-xs transition-all ${
              isLoading
                ? 'bg-[#EFE9DF] text-[#7A7265] cursor-not-allowed'
                : 'bg-[#24211D] hover:bg-[#3B342C] text-[#FAF8F5] active:scale-98'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>
              {isLoading
                ? 'ИИ подбирает книги...'
                : `Обновить ТОП-20 (${activeCategoryMeta.label})`}
            </span>
          </button>
        </div>
      </div>

      {/* CATEGORY TABS: A dedicated Top-20 per category */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A5A36] font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Категории рекомендаций (свой ТОП-20):
          </span>
          <span className="text-[11px] font-mono text-[#8A8172]">
            {availableCategories.length} категорий
          </span>
        </div>

        {/* Scrollable Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {availableCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 border ${
                  isSelected
                    ? 'bg-[#24211D] text-[#FAF8F5] border-[#24211D] shadow-xs'
                    : 'bg-[#FAF8F5] hover:bg-[#EFE9DF] text-[#4A4237] border-[#E8E2D8]'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                {cat.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${isSelected ? 'bg-amber-400 text-stone-900 font-bold' : 'bg-[#EAE2D5] text-[#7A7265]'}`}>
                    {cat.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Literary Taste Profile Banner for Active Category */}
      <div className="bg-[#FAF8F5] border border-[#E8E2D8] rounded-xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-[#EFE9DF] border border-[#DDD5C7] flex items-center justify-center shrink-0 text-xl shadow-2xs">
            {activeCategoryMeta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A5A36] font-semibold bg-[#EAE2D5] px-2 py-0.5 rounded">
                ТОП-20: {activeCategoryMeta.label}
              </span>
              <span className="text-xs text-[#7A7265] font-mono">
                {displayedRecommendations.length} {displayedRecommendations.length === 1 ? 'книга' : 'книг'}
              </span>
            </div>
            <p className="text-xs text-[#3B342C] mt-1">
              {selectedCategory === 'all' ? (
                <>Персональный срез лучших книг всех направлений с наивысшей совместимостью с вашим вкусом.</>
              ) : (
                <>Подборка двадцати лучших произведений строго в жанре «{activeCategoryMeta.label}», исключая уже прочитанные и скрытые книги.</>
              )}
            </p>
          </div>
        </div>

        {activeCategoryLastGen && (
          <div className="text-[11px] font-mono text-[#8A8172] shrink-0 self-end md:self-center">
            Сформировано: {new Date(activeCategoryLastGen).toLocaleDateString('ru-RU')}
          </div>
        )}
      </div>

      {/* WISHLIST SPOTLIGHT IN THIS CATEGORY */}
      {activeCategoryWishlistBooks.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50/90 via-[#FAF6EE] to-[#F5EFE6] border border-amber-200/90 rounded-xl p-4 sm:p-5 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <div>
                <h3 className="font-display font-semibold text-sm sm:text-base text-[#24211D]">
                  Из вашего виш-листа в категории «{activeCategoryMeta.label}» ({activeCategoryWishlistBooks.length})
                </h3>
                <p className="text-xs text-[#7A7265] mt-0.5">
                  Книги, которые вы сами запланировали к прочтению — они возглавляют персональный ТОП-20:
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-amber-900 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded font-semibold hidden sm:inline shrink-0">
              Вы хотите прочитать
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {activeCategoryWishlistBooks.map((wb) => {
              const isAddingWb = addingTitle === wb.title;
              const isReadingWb = userReadingTitles.has(wb.title.toLowerCase().trim()) || addedBookTitles.has(wb.title);

              return (
                <div
                  key={wb.id}
                  className="p-3 bg-white/95 border border-amber-200 rounded-lg flex items-center justify-between gap-3 shadow-2xs hover:border-amber-300 hover:shadow-xs transition-all"
                >
                  <div className="min-w-0">
                    <h4 className="font-semibold text-xs text-[#24211D] truncate">
                      «{wb.title}»
                    </h4>
                    <p className="text-[11px] text-[#7A7265] truncate mt-0.5">
                      {wb.authors?.join(', ') || 'Автор'}
                    </p>
                  </div>

                  {isReadingWb ? (
                    <span className="text-[11px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded font-medium shrink-0">
                      Читаю
                    </span>
                  ) : (
                    <button
                      onClick={(e) => handleStartReadingWishlist(wb, e)}
                      disabled={isAddingWb}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-[#8A5A36] hover:bg-[#6F4729] rounded flex items-center gap-1 shrink-0 shadow-2xs active:scale-95 transition-all"
                      title="Начать читать эту книгу из виш-листа"
                    >
                      <BookOpen className="w-3 h-3 text-amber-200" />
                      <span>{isAddingWb ? '...' : 'Начать'}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Control Bar: Reading Mood & Search */}
      <div className="space-y-2.5 bg-[#FAF8F5] p-3 sm:p-3.5 border border-[#E8E2D8] rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Mood Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
            <span className="text-[11px] text-[#7A7265] font-medium uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[#8A5A36]" /> Настроение:
            </span>
            {READING_MOODS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedMood(m.id);
                  handleGenerateCategoryRecommendations(m.id);
                }}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap text-xs ${
                  selectedMood === m.id
                    ? 'bg-[#24211D] text-[#FAF8F5] font-semibold shadow-xs'
                    : 'bg-[#EFE9DF] text-[#6B6357] hover:text-[#24211D]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Quick Search inside this category */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8A8172]" />
            <input
              type="text"
              placeholder={`Поиск в ТОП-20 (${activeCategoryMeta.label})...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FAF8F5] border border-[#DDD5C7] rounded pl-8 pr-7 py-1.5 text-xs text-[#24211D] focus:outline-none focus:border-[#24211D]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8172] hover:text-[#24211D]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* UNDO TOAST NOTICE FOR "НЕ РЕКОМЕНДОВАТЬ" */}
      {lastDismissedNotice && (
        <div className="p-3 bg-[#24211D] text-[#FAF8F5] rounded-lg text-xs flex items-center justify-between gap-3 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <EyeOff className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="truncate">
              Книга <strong>«{lastDismissedNotice.title}»</strong> скрыта и больше не будет рекомендована.
            </span>
          </div>
          <button
            onClick={() => handleRestoreBook(lastDismissedNotice.title)}
            className="px-2.5 py-1 bg-[#3B342C] hover:bg-[#4E453A] text-amber-200 rounded font-semibold text-xs transition-colors shrink-0 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Отменить</span>
          </button>
        </div>
      )}

      {/* ERROR MESSAGE IF ANY */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button
            onClick={() => handleGenerateCategoryRecommendations()}
            className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded font-semibold text-xs transition-colors shrink-0"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {/* LOADING STATE */}
      {isLoading ? (
        <div className="py-20 px-4 text-center border border-dashed border-[#DDD5C7] rounded-xl bg-[#F7F4EF] space-y-4 max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-full bg-[#EFE9DF] border border-[#D9CDB8] flex items-center justify-center mx-auto text-[#8A5A36]">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base sm:text-lg text-[#24211D]">
              ИИ формирует ТОП-20: {activeCategoryMeta.label}
            </h3>
            <p className="mt-1.5 text-xs text-[#6B6357] leading-relaxed">
              Анализируем ваш профиль читателя, предпочтения в категории «{activeCategoryMeta.label}» и исключаем скрытые книги...
            </p>
          </div>
          <div className="w-48 h-1.5 bg-[#EFE9DF] rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-[#8A5A36] rounded-full animate-indeterminate" />
          </div>
        </div>
      ) : displayedRecommendations.length === 0 ? (
        /* EMPTY STATE FOR THIS CATEGORY */
        <div className="py-16 text-center border border-dashed border-[#DDD5C7] rounded-lg bg-[#F7F4EF] max-w-lg mx-auto space-y-4">
          <div className="text-3xl">{activeCategoryMeta.icon}</div>
          <h3 className="text-base font-display font-medium text-[#24211D]">
            {searchQuery ? 'Ничего не найдено по вашему запросу' : `Все доступные книги в категории «${activeCategoryMeta.label}» прочитаны или скрыты`}
          </h3>
          <p className="text-xs text-[#6B6357] max-w-sm mx-auto">
            {searchQuery
              ? 'Попробуйте изменить поисковую фразу.'
              : 'Вы можете обновить список через ИИ или восстановить скрытые книги.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 text-xs font-medium text-[#24211D] bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded transition-colors"
              >
                Очистить поиск
              </button>
            )}
            <button
              onClick={() => handleGenerateCategoryRecommendations()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#24211D] hover:bg-[#3B342C] rounded transition-colors"
            >
              Сгенерировать новый ТОП-20
            </button>
          </div>
        </div>
      ) : (
        /* DEDICATED TOP-20 CARDS FOR THE SELECTED CATEGORY */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {displayedRecommendations.map((book, idx) => {
            const titleKey = book.title.toLowerCase().trim();
            const isWishlist = book.isWishlist || userWishlistMap.has(titleKey);
            const isCompleted = userCompletedTitles.has(titleKey);
            const isReading = userReadingTitles.has(titleKey);
            const isAddedNow = addedBookTitles.has(book.title);
            const isAdding = addingTitle === book.title;

            return (
              <div
                key={book.id || idx}
                onClick={() => setInspectedBook(book)}
                className={`relative rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group overflow-hidden cursor-pointer border ${
                  isWishlist
                    ? 'bg-[#FAF7F0] border-amber-300 ring-1 ring-amber-200/60 hover:border-amber-400'
                    : 'bg-[#FAF8F5] border-[#E8E2D8] hover:border-[#C4B7A5]'
                }`}
              >
                {/* Top Section */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Stylized Book Spine / Cover Mockup */}
                      <div 
                        className="w-11 h-16 sm:w-13 sm:h-18 rounded-[3px] shadow-md shrink-0 p-1.5 flex flex-col justify-between text-white relative overflow-hidden"
                        style={{ backgroundColor: book.coverColor }}
                      >
                        <div className="absolute top-0 left-0 bottom-0 w-1 bg-white/20" />
                        <span className="text-[7px] uppercase tracking-wider font-mono opacity-70 line-clamp-1">
                          {book.genres[0]}
                        </span>
                        <p className="text-[8px] font-serif font-bold line-clamp-2 leading-tight">
                          {book.title}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-[#8A5A36] bg-[#EFE9DF] px-1.5 py-0.5 rounded">
                            #{idx + 1} в категории
                          </span>
                          {isWishlist && (
                            <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                              <span>⭐</span> В вашем виш-листе
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                            {book.matchScore}% совпадение
                          </span>
                        </div>
                        <h3 className="font-display font-semibold text-base sm:text-lg text-[#24211D] mt-1 leading-snug truncate">
                          {book.title}
                        </h3>
                        <p className="text-xs text-[#7A7265] mt-0.5 font-medium truncate">
                          {book.author}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons: Add to Library & Do Not Recommend */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* "Не рекомендовать" Button */}
                      <button
                        onClick={(e) => handleDismissBook(book, e)}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 text-[#8A8172] hover:text-rose-700 hover:bg-rose-50 border border-[#E8E2D8] hover:border-rose-200 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                        title="Больше не рекомендовать эту книгу"
                      >
                        <EyeOff className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline text-[11px] whitespace-nowrap">Не рекомендовать</span>
                      </button>

                      {/* Quick Action Button */}
                      {isWishlist ? (
                        <button
                          onClick={(e) => handleQuickAdd(book, e)}
                          disabled={isAdding}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#8A5A36] hover:bg-[#6F4729] text-white shadow-xs active:scale-95 transition-all"
                          title="Начать читать эту книгу из вашего виш-листа"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-amber-200" />
                          <span>{isAdding ? '...' : 'Начать читать'}</span>
                        </button>
                      ) : isReading || isAddedNow ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                          <span className="hidden sm:inline">Читаю</span>
                        </div>
                      ) : isCompleted ? (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="hidden sm:inline">Прочитано</span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleQuickAdd(book, e)}
                          disabled={isAdding}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#24211D] hover:bg-[#3B342C] text-white shadow-xs active:scale-95 transition-all"
                          title="Добавить в список для чтения"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isAdding ? '...' : '+ Читать'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Why it matches */}
                  <div className="mt-3 p-2.5 rounded-lg bg-[#F5EFE6] border border-[#EAE0D2] text-xs text-[#4A3D2E] leading-relaxed">
                    <span className="font-semibold text-[#8A5A36] block mb-0.5">
                      💡 Почему вам понравится:
                    </span>
                    {book.reason}
                  </div>

                  {/* Description preview */}
                  <p className="mt-2.5 text-xs text-[#6B6357] leading-relaxed line-clamp-2">
                    {book.description}
                  </p>
                </div>

                {/* Bottom metadata tags */}
                <div className="mt-4 pt-3 border-t border-[#E8E2D8] flex items-center justify-between text-[11px] text-[#7A7265] font-mono">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {book.keyThemes.slice(0, 3).map((theme, tIdx) => (
                      <span key={tIdx} className="bg-[#EFE9DF] px-2 py-0.5 rounded text-[10px] text-[#5C5446]">
                        #{theme}
                      </span>
                    ))}
                  </div>

                  <span className="shrink-0 text-[#8A8172]">
                    ~{book.estimatedPages} стр.
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DISMISSED BOOKS MODAL ("НЕ РЕКОМЕНДОВАТЬ") */}
      {isDismissedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#FAF8F5] border border-[#DDD5C7] rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#E8E2D8] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                  <EyeOff className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-base text-[#24211D]">
                    Скрытые рекомендации
                  </h3>
                  <p className="text-xs text-[#7A7265]">
                    Эти книги исключены из всех подборок и больше не будут предлагаться ИИ
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDismissedModalOpen(false)}
                className="p-1.5 text-[#8A8172] hover:text-[#24211D] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
              {dismissedBooks.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#7A7265]">
                  У вас пока нет скрытых книг. Нажмите «Не рекомендовать» на любой карточке, чтобы исключить её.
                </div>
              ) : (
                dismissedBooks.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white border border-[#E8E2D8] rounded-lg flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <h4 className="font-medium text-xs text-[#24211D] truncate">
                        «{item.title}»
                      </h4>
                      <p className="text-[11px] text-[#7A7265] truncate">
                        {item.author}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRestoreBook(item.title)}
                      className="px-2.5 py-1 text-xs font-medium text-[#24211D] bg-[#EFE9DF] hover:bg-[#E4DCCE] rounded flex items-center gap-1 shrink-0 transition-colors"
                      title="Вернуть в рекомендации"
                    >
                      <RotateCcw className="w-3 h-3 text-[#8A5A36]" />
                      <span>Восстановить</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            {dismissedBooks.length > 0 && (
              <div className="p-3 sm:p-4 border-t border-[#E8E2D8] bg-[#F7F4EF] flex items-center justify-between">
                <span className="text-xs text-[#7A7265] font-mono">
                  Всего скрыто: {dismissedBooks.length}
                </span>
                <button
                  onClick={handleClearAllDismissed}
                  className="px-3 py-1.5 text-xs text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded font-medium transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Очистить весь список</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INSPECTED BOOK PREVIEW MODAL */}
      {inspectedBook && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4" onClick={() => setInspectedBook(null)}>
          <div 
            className="bg-[#FAF8F5] border border-[#DDD5C7] rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with cover color banner */}
            <div 
              className="p-5 text-white relative"
              style={{ backgroundColor: inspectedBook.coverColor }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">
                    {inspectedBook.genres.join(' • ')}
                  </span>
                  <h3 className="font-display font-bold text-xl sm:text-2xl mt-1.5 leading-tight">
                    {inspectedBook.title}
                  </h3>
                  <p className="text-sm opacity-90 mt-0.5">
                    {inspectedBook.author}
                  </p>
                </div>

                <button
                  onClick={() => setInspectedBook(null)}
                  className="p-1.5 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded font-semibold">
                  {inspectedBook.matchScore}% совместимость
                </span>
                <span className="text-[11px] font-mono text-[#7A7265] bg-[#EFE9DF] px-2 py-1 rounded">
                  Объём: ~{inspectedBook.estimatedPages} страниц
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#F5EFE6] border border-[#EAE0D2] text-[#4A3D2E] leading-relaxed">
                <span className="font-semibold text-[#8A5A36] block mb-1">
                  💡 Персональное обоснование под ваш литературный вкус:
                </span>
                {inspectedBook.reason}
              </div>

              <div>
                <h4 className="font-semibold text-[#24211D] mb-1.5">
                  Аннотация и сюжетные акценты:
                </h4>
                <p className="text-[#6B6357] leading-relaxed">
                  {inspectedBook.description}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-[#24211D] mb-1.5">
                  Ключевые темы:
                </h4>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {inspectedBook.keyThemes.map((theme, i) => (
                    <span key={i} className="bg-[#EFE9DF] px-2 py-0.5 rounded text-[11px] text-[#5C5446] font-mono">
                      #{theme}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 border-t border-[#E8E2D8] bg-[#F7F4EF] flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  handleDismissBook(inspectedBook);
                  setInspectedBook(null);
                }}
                className="px-3 py-2 text-xs font-medium text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Не рекомендовать</span>
              </button>

              {userWishlistMap.has(inspectedBook.title.toLowerCase().trim()) ? (
                <button
                  onClick={() => {
                    handleQuickAdd(inspectedBook);
                    setInspectedBook(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs bg-[#8A5A36] hover:bg-[#6F4729] text-white active:scale-95 transition-all"
                >
                  <BookOpen className="w-4 h-4 text-amber-200" />
                  <span>Начать читать (из виш-листа)</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleQuickAdd(inspectedBook);
                    setInspectedBook(null);
                  }}
                  disabled={userCompletedTitles.has(inspectedBook.title.toLowerCase().trim()) || userReadingTitles.has(inspectedBook.title.toLowerCase().trim()) || addedBookTitles.has(inspectedBook.title)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-all ${
                    userCompletedTitles.has(inspectedBook.title.toLowerCase().trim()) || userReadingTitles.has(inspectedBook.title.toLowerCase().trim()) || addedBookTitles.has(inspectedBook.title)
                      ? 'bg-emerald-100 text-emerald-800 cursor-default'
                      : 'bg-[#24211D] hover:bg-[#3B342C] text-white active:scale-95'
                  }`}
                >
                  {userCompletedTitles.has(inspectedBook.title.toLowerCase().trim()) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Уже прочитано</span>
                    </>
                  ) : userReadingTitles.has(inspectedBook.title.toLowerCase().trim()) || addedBookTitles.has(inspectedBook.title) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span>Читаю сейчас</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Добавить в список («Читаю»)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
