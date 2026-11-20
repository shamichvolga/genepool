//------------------------------------------------------------------------------
// Language (English / Russian) and the little "?" hints.
//
// The page is written in English. Russian: every text of the panel whose
// English is in RU below is shown in Russian (the English is remembered, so
// switching back is exact). Texts that change all the time (the swimbot card,
// the status line, the graph numbers) go through tr() / translateHTML() when
// they are shown.
//
// Hints: an element with data-hint="key" gets a small "?" in its top right
// corner; pointing at it (or tapping it) shows HINTS[key] in the language.
// The rows of the swimbot card get theirs by their English label.
//------------------------------------------------------------------------------

export type Lang = "en" | "ru";
let _lang: Lang = "en";
try { if ( localStorage.getItem( "genepool.lang" ) === "ru" ) _lang = "ru"; } catch ( e ) { /* (no storage) */ }
export function lang(): Lang { return _lang; }

//------------------------------------------------------------
// English -> Russian
//------------------------------------------------------------
const RU: Record<string, string> =
{
    // view
    "whole pool": "весь бассейн", "autotracking": "автослежение", "selected": "выбранный", "mutual love": "взаимная любовь",
    "most prolific": "самый плодовитый", "most efficient": "самый ловкий", "oldest virgin": "старейший девственник", "glutton": "обжора",
    "mouth/genital": "рот / гениталии", "currents": "течения", "soil": "почва", "rendering OFF": "рисование ВЫКЛ",
    // tabs
    "pool": "бассейн", "swimbot": "свимбот", "tweak": "настройка", "graph": "график", "info": "инфо",
    // pool tab
    "start a new pool": "новый бассейн", "random": "случайный", "neighborhoods": "соседства", "froggies": "лягушата", "speciation": "видообразование",
    "food race": "гонка за едой", "big bang": "большой взрыв", "genetic barrier": "генетический барьер", "empty": "пустой",
    "petri: life starts in the mildest zone and must conquer the others": "петри: жизнь начинается в самой мягкой зоне и должна завоевать остальные",
    "petri": "петри", "zones": "зоны", "border": "граница", "stripes": "полосы",
    "world size (starts a new random pool)": "размер мира (запускает новый случайный бассейн)",
    "small": "малый", "normal": "обычный", "large": "большой", "huge": "огромный",
    "debug mode: change any number of the world while it runs": "режим отладки: менять любые числа мира на ходу",
    "dominant species: who lives in the pool": "доминирующие виды: кто живёт в бассейне",
    "map editor: draw the world before it starts": "редактор карты: нарисовать мир до старта", "map editor…": "редактор карты…",
    "save the world": "сохранить мир",
    "Everything goes into one file: every swimbot and plant, diseases, climate, the clock. A loaded world goes on from the same step.":
        "Всё идёт в один файл: каждый свимбот и растение, болезни, климат, часы. Загруженный мир продолжится с того же шага.",
    "save world": "сохранить мир", "load world…": "загрузить мир…", "with the family tree": "с родословной",
    "download the whole world as a .gpworld file": "скачать весь мир одним файлом .gpworld",
    "load a .gpworld file and go on from there": "загрузить файл .gpworld и продолжить с него",
    "the family tree grows with every birth; it is not needed for the world to go on": "родословная растёт с каждым рождением; для продолжения мира она не нужна",
    "research data": "данные для исследований", "print swimbot data": "вывести данные свимботов",
    // swimbot tab
    "No swimbot is selected: click one in the pool. Or create one:": "Свимбот не выбран: щёлкните по нему в бассейне. Или создайте:",
    "random genes": "случайные гены", "load genes…": "загрузить гены…", "from a preset": "из пресета",
    "your swimbots": "ваши свимботы", "bred by": "выведены", "mutate": "мутировать", "randomize": "случайные гены", "clone": "клонировать",
    "predator ⟳": "хищник ⟳", "immortal ⟳": "бессмертный ⟳", "kill": "убить", "feed": "накормить", "tweak genes": "править гены", "save genes": "сохранить гены",
    // tweak tab
    "ecosystem": "экосистема", "food growth delay": "задержка роста еды", "food spread": "разброс еды", "food bit energy": "энергия кусочка еды",
    "maximum age": "предельный возраст", "reset to defaults": "сбросить", "experiment: one mate-approach rule for everybody": "эксперимент: одно правило выбора партнёра для всех",
    "population limit": "лимит популяции", "maximum body parts": "максимум члеников",
    "hunger threshold, mate choosiness, diet, temperature preference and the energy given to a child are inherited genes now: see the swimbot tab.":
        "порог голода, разборчивость, питание, любимая температура и энергия, которую получает ребёнок, теперь наследуемые гены: смотрите вкладку «свимбот».",
    "colorful": "яркий", "not colorful": "бледный", "big": "большой", "hyper": "резвый", "still": "спокойный", "long": "длинный", "short": "короткий",
    "straight": "прямой", "crooked": "кривой", "similar color": "похожий цвет", "similar size": "похожий размер", "similar hyper": "похожая резвость",
    "similar length": "похожая длина", "similar straight": "похожая прямизна", "closest": "ближайший",
    // graph tab
    "population": "население", "whole population": "всё население", "mutate all (50%)": "мутировать всех (50%)", "mutate half": "мутировать половину",
    "randomize all": "случайные гены всем", "randomize half": "случайные гены половине", "all": "всё", "last 50k": "последние 50k", "last 10k": "последние 10k",
    "herbivores": "травоядные", "predators": "хищники", "plants": "растения", "meat": "мясо", "step": "шаг",
    // info
    "previous": "назад", "next": "дальше",
    // keys help
    "Keys": "Клавиши", "move the view": "двигать вид", "zoom": "приблизить / отдалить", "freeze / go on": "пауза / дальше",
    "speed: normal, fast, as fast as possible": "скорость: обычная, быстрая, максимальная", "drawing on / off (faster when off)": "рисование вкл / выкл (без него быстрее)",
    "show mouths and genitals": "показать рты и гениталии", "water currents on / off (shown as faint arrows)": "течения вкл / выкл (видны как бледные стрелки)",
    "soil oases on / off": "почвенные оазисы вкл / выкл",
    "up close: bodies on the graphics card too (faster, a little plainer)": "вблизи: тела тоже рисует видеокарта (быстрее, чуть проще)",
    "hide / show the panel": "спрятать / показать панель", "next panel tab": "следующая вкладка", "this help (click to close)": "эта справка (щелчок закрывает)",
    // swimbot card
    "goal": "цель", "age": "возраст", "energy": "энергия", "hunger threshold": "порог голода", "segments": "сегменты", "food eaten": "съедено еды",
    "prey eaten": "съедено добычи", "offspring": "потомков", "attracted to": "привлекает", "likes temperature": "любимая температура",
    "temperature here": "температура здесь", "digests": "переваривает", "brightness": "яркость", "drops a part": "сбрасывает часть",
    "parts eaten": "откушено частей", "hunts for": "охотится на", "brain": "мозг", "swims": "плавание", "climate pull": "тяга к климату",
    "company": "общество", "food preferred": "любимая еда", "food digested best": "лучше переваривает", "gives a child": "отдаёт ребёнку", "of its energy": "своей энергии",
    "max energy": "запас энергии", "sick": "болен", "eats young": "ест молодняк", "prefers weak prey": "предпочитает слабых",
    "herbivore": "травоядное", "predator": "хищник", "immortal": "бессмертный",
    "resting": "отдыхает", "looking for mate": "ищет партнёра", "pursuing mate": "плывёт к партнёру", "looking for food bit": "ищет еду",
    "pursuing food bit": "плывёт к еде", "looking for prey": "ищет добычу", "pursuing prey": "преследует добычу", "fleeing predator": "убегает от хищника",
    "never": "никогда", "when chased": "когда гонятся", "missing": "не хватает", "neural": "нейросеть", "effort": "усилие",
    "seeks": "ищет", "avoids": "избегает", "green": "зелёная", "blue": "синяя", "medium": "средний", "medium prey": "среднюю добычу", "prey": "добычу", "of body": "тела", "bitten": "при укусе",
    "suits": "подходит", "picky": "разборчивость", "no (gene": "нет (ген", "yes (gene": "да (ген",
    // status line and graph text
    "FROZEN (space)": "ПАУЗА (пробел)", "steps/s": "шагов/с", "steps/sec": "шагов/с", "time step": "шаг времени", "speed": "скорость", "threads": "потоков",
    "swimbots": "свимботов", "green plants": "зелёные растения", "blue plants": "синие растения",
    "genetic clusters (used genes)": "генетические кластеры (по используемым генам)", "largest": "крупнейший",
    "spring": "весна", "summer": "лето", "autumn": "осень", "winter": "зима", "move": "движение", "look": "взгляд", "act": "действия",
    // footer
    "modified by": "изменения:", "original by": "оригинал:",
    // buttons with titles
    "pause / go on (space)": "пауза / дальше (пробел)", "normal speed (50 steps per second)": "обычная скорость (50 шагов в секунду)",
    "fast (250 steps per second)": "быстро (250 шагов в секунду)", "as fast as the computer can": "так быстро, как может компьютер",
    "big graph over the pool (or double-click the graph)": "большой график поверх бассейна (или двойной щелчок по графику)",
    "hide the panel (H)": "спрятать панель (H)", "show the panel (H)": "показать панель (H)",
    "water currents: big slow eddies carry swimbots and meat (C)": "течения: большие медленные вихри носят свимботов и мясо (C)",
    "herbivore → predator → strong predator → herbivore": "травоядное → хищник → сильный хищник → травоядное",
    "never dies of age or hunger, cannot be eaten": "не умирает от старости и голода, его нельзя съесть", "+100 energy": "+100 энергии",
    "drawing off: faster": "рисование выкл: быстрее", "drawing on": "рисование вкл",
    // remaining static and dynamic interface text
    "press ? for the keys": "нажмите ? — справка по клавишам",
    "W A S D, arrows": "W A S D, стрелки", "Q E, − +, wheel": "Q E, − +, колесо",
    "start a 'petri' pool with these settings": "запустить бассейн «петри» с этими настройками",
    "how many zones (2-12)": "количество зон (2–12)",
    "the shape of the zones: click to change": "форма зон: щёлкните, чтобы изменить",
    "border between zones: 0 = sharp, 1 = soft (as wide as a zone)": "граница зон: 0 — резкая, 1 — плавная (шириной с зону)",
    "8000 × 8000, about 500 swimbots": "8000 × 8000, около 500 свимботов",
    "16000 × 16000, about 2000 swimbots": "16000 × 16000, около 2000 свимботов",
    "24000 × 24000, about 4500 swimbots": "24000 × 24000, около 4500 свимботов",
    "32000 × 32000, about 8000 swimbots (needs a fast computer)": "32000 × 32000, около 8000 свимботов (нужен быстрый компьютер)",
    "Run a pool (for example \"speciation\") for tens of thousands of steps, then get the data collected during the simulation and load it into":
        "Запустите бассейн (например, «видообразование») на десятки тысяч шагов, затем получите собранные данные и загрузите их в",
    "show gene data": "показать данные генов", "(no data)": "(нет данных)",
    "SELECT THIS PANEL TO TURN ON RENDERING": "НАЖМИТЕ ЗДЕСЬ, ЧТОБЫ ВКЛЮЧИТЬ РИСОВАНИЕ",
    "Rendering is currently turned off. It makes the simulation run faster.": "Рисование сейчас выключено, поэтому симуляция работает быстрее.",
    "page": "страница", "of": "из", "shape": "форма", "rings": "кольца", "star": "звезда", "spiral": "спираль",
    "zones (click the picture to change the shape)": "зон (щёлкните по картинке, чтобы изменить форму)",
    "opposite color": "противоположный цвет",
    "who a swimbot swims towards; whether the partner accepts is decided by its own genes": "к кому плывёт свимбот; согласие партнёра определяется его собственными генами",
    "Tweak the genes of swimbot": "Изменение генов свимбота", "(choose which limb type to tweak)": "(выберите тип частей тела)",
    "energy (the mark: hunger threshold)": "энергия (отметка — порог голода)",
    "Swimbot Data (copy and paste into a text file, then load into Gene Pool Lab)": "Данные свимботов (скопируйте в текстовый файл и загрузите в Gene Pool Lab)",
    "collecting the data…": "собираю данные…", "Load a new pool from a file": "Загрузить новый бассейн из файла",
    "Name this swimbot...": "Назовите этого свимбота…", "choose from the list of saved swimbots:": "выберите из списка сохранённых свимботов:",
    "Save genes of swimbot": "Сохранить гены свимбота",
    "Please copy the genetic data below and put it in an": "Скопируйте генетические данные ниже в",
    "empty text file. Give it a cool name and save it.": "пустой текстовый файл, придумайте ему название и сохраните.",
    "This is formatted as JSON, which is required": "Формат JSON нужен для того, чтобы",
    "for it to be loaded back into the pool.": "снова загрузить эти гены в бассейн.",
    "Copy the text below, put it in a new text file, and then give": "Скопируйте текст ниже в новый текстовый файл и дайте ему",
    "the file a unique name ending in '.json' (example: 'my_pool.json')": "уникальное имя с расширением .json (например, my_pool.json).",
    "Swimbot loaded successfully!": "Свимбот успешно загружен!",
    "Error: the file does not contain valid genes.": "Ошибка: файл не содержит действительных генов.",
    "Error reading the file: ": "Ошибка чтения файла: ",
    "yes": "да", "swimbot index:": "индекс свимбота:", "parent 1 index:": "индекс родителя 1:", "parent 2 index:": "индекс родителя 2:",
    "birth time:": "время рождения:", "death time:": "время смерти:", "genes:": "гены:",
    // gene editor
    "junk": "не используется", "frequency": "частота", "cutoff": "отсечка",
    "start red": "нач. красный", "start green": "нач. зелёный", "start blue": "нач. синий",
    "end red": "конеч. красный", "end green": "конеч. зелёный", "end blue": "конеч. синий",
    "start width": "нач. ширина", "end width": "конеч. ширина", "start length": "нач. длина", "end length": "конеч. длина",
    "amplitude": "амплитуда", "phase": "фаза", "turn amplitude": "амплитуда поворота", "turn phase": "фаза поворота",
    "branch amplitude": "амплитуда ветви", "branch phase": "фаза ветви", "branch turn amplitude": "поворот амплитуды ветви",
    "branch turn phase": "поворот фазы ветви", "sequence count": "число повторов", "branch period": "период ветвления",
    "branch angle": "угол ветвления", "branch number": "число ветвей", "branch shift": "сдвиг ветви",
    "branch category": "категория ветви", "branch reflect": "отражение ветви", "splined": "сглаживание", "end cap spline": "сглаживание конца",
    "preferred food type": "любимый тип еды", "digestible food type": "перевариваемый тип еды",
    // additional UI elements from audit
    "Space": "Пробел",
    "? or F1": "? или F1",
    "Gene Pool": "Генофонд",
    "EN": "АНГ",
    "· RU": "· РУС",
    "Debug mode": "Режим отладки",
    "apply the changes to the running world": "применить изменения к работающему миру",
    "cancel the typed changes": "отменить введённые изменения",
    "back to the numbers of the code": "вернуть числа из кода",
    "save the numbers and the window layout as a preset": "сохранить числа и расположение окон как пресет",
    "delete the chosen preset": "удалить выбранный пресет",
    "put the windows back in their places": "вернуть окна на места",
    "search by name or description": "поиск по имени или описанию",
    "only changed": "только изменённые",
    "Enter": "Ввод",
    "Escape": "Выход",
    "Map editor": "Редактор карты",
    "Tools": "Инструменты",
    "draw the outline of a zone": "нарисовать контур зоны",
    "fill a zone outlined with the pencil": "залить зону, очерченную карандашом",
    "spray founders: each dot is a swimbot at the start": "распылить основателей: каждая точка — свимбот на старте",
    "a wall across the pool: drag from a wall to grow another out of it (a T...)": "стена через бассейн: тащите от стены, чтобы вырастить из неё другую (букву Т...)",
    "wipe dots and zones under the brush": "стереть точки и зоны под кистью",
    "Fill with": "Заполнить",
    "plants grow here at the normal density (on a blank map: only here)": "растения растут здесь с обычной плотностью (на пустой карте: только здесь)",
    "only meat here: at the start and falling as fast as it rots": "только мясо здесь: в начале и падает так же быстро, как гниёт",
    "Seeder": "Сеятель",
    "as usual (a tenth predators)": "как обычно (десятая часть хищников)",
    "Walls": "Стены",
    "Presets": "Пресеты",
    "save preset": "сохранить пресет",
    "download file": "скачать файл",
    "load file…": "загрузить файл…",
    "start the world on this map": "запустить мир на этой карте",
    "erase all": "стереть всё",
    "· blank map": "· пустая карта",
    "There is no wall to copy yet.": "Ещё нет стены для копирования.",
    "No more room: the barrier holds": "Места больше нет: барьер держится",
    "The barrier is gone.": "Барьер исчез.",
    "No more room: the pool holds": "Места больше нет: бассейн держится",
    "Click inside a zone outlined with the pencil.": "Щёлкните внутри зоны, очерченной карандашом.",
    "Now take the fill and click inside the outline.": "Теперь возьмите заливку и щёлкните внутри контура.",
    "Name of the map preset:": "Название пресета карты:",
    "The browser has no room for it: download it as a file.": "В браузере нет места: скачайте его как файл.",
    "no map": "нет карты",
    "This file is not a map.": "Этот файл не является картой.",
    "random (in the range)": "случайно (в диапазоне)",
    "Dominant species": "Доминирующие виды",
    "Right click on a piece: genes, destroy. The area is the share of all swimbots.": "Правый клик по кусочку: гены, уничтожить. Площадь — доля от всех свимботов.",
    "Download average genes": "Скачать средние гены",
    "Destroy this species": "Уничтожить этот вид",
    "Destroy species": "Уничтожить вид",
    "Attraction set to": "Привлекательность установлена на",
    "Value": "Значение",
    "Canvas": "Холст",
    "Button": "Кнопка",
    "Cannot load pool: saving to a server is not available in this version": "Не удаётся загрузить бассейн: сохранение на сервер недоступно в этой версии",
    "from file": "из файла",
    "Do you want to save the current pool": "Хотите сохранить текущий бассейн",
    "before loading": "перед загрузкой",
    "'big bang'": "«большой взрыв»",
    "'bad parents'": "«плохие родители»",
    "time step:": "шаг времени:",
    "green plants:": "зелёные растения:",
    "blue plants:": "синие растения:",
    "Slash": "Слэш",
    "ms (brain": "мс (мозг",
    ", move": ", движение",
    ", look": ", взгляд",
    ", act": ", действия",
    "load world": "загрузить мир",
    "Saving the world…": "Сохраняю мир…",
    "Could not save the world:": "Не удалось сохранить мир:",
    "World saved:": "Мир сохранён:",
    "Loading the world…": "Загружаю мир…",
    "World loaded: step": "Мир загружен: шаг",
    "Not the same in:": "Отличается в:",
    "(saved by changing code: may not go on exactly)": "(сохранено после изменения кода: может идти не точно)",
    "Could not keep the file for the reload:": "Не удалось сохранить файл для перезагрузки:",
    "The file is from another world size: reloading…": "Файл из мира другого размера: перезагружаю…",
    "Could not load:": "Не удалось загрузить:",
    "Commons Clause": "Commons Clause",
    "Jeffrey Ventrella": "Джеффри Вентрелла",
};

// the English of a text, translated if Russian is on
export function tr( en: string ): string
{
    if ( _lang === "en" ) return en;
    const key = en.trim().replace( /\s+/g, " " );
    const translated = RU[ key ];
    if ( translated === undefined ) return en;
    const leading = /^\s*/.exec( en )![ 0 ];
    const trailing = /\s*$/.exec( en )![ 0 ];
    return leading + translated + trailing;
}

// HTML made in English (the status line, the graph numbers): known words and
// phrases replaced, longest first (so "green plants" wins over "green")
let _phrases: string[] | null = null;
export function translateHTML( html: string ): string
{
    if ( _lang === "en" ) return html;
    if ( _phrases === null ) { _phrases = Object.keys( RU ).filter( k => k.length > 2 ).sort( ( a, b ) => b.length - a.length ); }
    const withTitles = html.replace( /(\stitle\s*=\s*)(["'])(.*?)\2/g, ( _m, start, quote, text ) => start + quote + tr( text ) + quote );
    // only the text between tags
    return withTitles.replace( /(^|>)([^<]+)/g, ( _m, start, text ) => start + translateText( text ));
}
function translateText( text: string ): string
{
    for ( const p of _phrases! )
    {
        if ( text.indexOf( p ) < 0 ) continue;
        const re = new RegExp( "(^|[^A-Za-z])" + p.replace( /[.*+?^${}()|[\]\\]/g, "\\$&" ) + "(?![A-Za-z])", "g" );
        text = text.replace( re, ( _m, before ) => before + RU[ p ] );
    }
    return text;
}

//------------------------------------------------------------
// the hints: what a number means and how it works
//------------------------------------------------------------
type Hint = { en: string, ru: string };
export const HINTS: Record<string, Hint> =
{
    "goal": { en: "What the brain is busy with right now: food, a mate, prey, running from a predator or resting.",
              ru: "Чем сейчас занят мозг: ищет еду, партнёра, добычу, убегает от хищника или отдыхает." },
    "age": { en: "Steps lived. Near the end of its life span the body slowly turns grey (old), and predators of any size may take it.",
             ru: "Сколько шагов прожито. Под конец жизни тело сереет (старость), и тогда его может съесть хищник любого размера." },
    "energy": { en: "Energy now / the most it can store. Swimming costs energy (more for a long, heavy body); food and prey bring it. At 0 it starves.",
                ru: "Энергия сейчас / сколько помещается. Плавание тратит энергию (длинное тяжёлое тело — больше), еда и добыча приносят. На нуле — смерть от голода." },
    "max energy": { en: "How much energy fits in. A body heavier than usual stores more (it grows with the mass), so big hunters can last between meals.",
                    ru: "Сколько энергии помещается. Тело тяжелее обычного запасает больше (растёт с массой), поэтому крупный хищник дольше живёт между трапезами." },
    "hunger threshold": { en: "An inherited gene. Below this energy the swimbot looks for food; above it, for a mate. The mark on the energy bar.",
                          ru: "Наследуемый ген. Ниже этой энергии свимбот ищет еду, выше — партнёра. Это отметка на полоске энергии." },
    "segments": { en: "Body parts. More parts: more ways to swim, but a heavier body that costs more to move and to grow.",
                  ru: "Части тела. Больше частей — больше способов плавать, но тело тяжелее: двигать и выращивать его дороже." },
    "food eaten": { en: "Plants and meat eaten in its life.", ru: "Сколько растений и мяса съедено за жизнь." },
    "prey eaten": { en: "Live swimbots it caught and ate. A bite needs the mouth to touch any part of the prey's body.",
                    ru: "Сколько живых свимботов поймано и съедено. Для укуса рот должен коснуться любой части тела добычи." },
    "offspring": { en: "Children it had. Each child takes a share of both parents' energy (the gene \"gives a child\").",
                   ru: "Сколько детей. Каждый ребёнок забирает долю энергии обоих родителей (ген «отдаёт ребёнку»)." },
    "gives a child": { en: "An inherited gene: the share of its energy a parent gives every child (15–85 %). Big gifts: fewer but stronger children.",
                       ru: "Наследуемый ген: какую долю своей энергии родитель отдаёт каждому ребёнку (15–85 %). Щедрые — меньше детей, но сильнее." },
    "attracted to": { en: "Which partners it swims towards. Whether the partner accepts is decided by the partner's own genes.",
                      ru: "К каким партнёрам свимбот плывёт. Согласится ли партнёр — решают его собственные гены." },
    "likes temperature": { en: "An inherited gene: the water temperature it likes ± how much it tolerates. Out of its range it spends more energy.",
                           ru: "Наследуемый ген: любимая температура воды ± сколько терпит. Вне своего диапазона тратит больше энергии." },
    "temperature here": { en: "The water temperature where it swims now, and how well it suits this swimbot.",
                          ru: "Температура воды там, где он сейчас, и насколько она ему подходит." },
    "digests": { en: "How much of a plant's energy it gets, by plant colour (an inherited gene).", ru: "Сколько энергии растения он получает, по цвету растения (наследуемый ген)." },
    "brightness": { en: "How bright its colours are: bright bodies attract mates but are easier for predators to see. Picky: how choosy it is about mates.",
                    ru: "Насколько яркий окрас: яркие привлекают партнёров, но хищникам их легче заметить. Разборчивость — насколько придирчив к партнёрам." },
    "drops a part": { en: "Like a lizard's tail: when bitten (or chased) it may drop a part of its body; the part grows back later.",
                      ru: "Как хвост ящерицы: при укусе (или погоне) может сбросить часть тела, потом она отрастает." },
    "parts eaten": { en: "Dropped parts that predators ate.", ru: "Сколько сброшенных частей съели хищники." },
    "hunts for": { en: "Its \"search image\": the colour and size of prey it got used to catching; it sees such prey from further away.",
                   ru: "«Образ добычи»: цвет и размер добычи, которую он привык ловить; такую он замечает издалека." },
    "brain": { en: "Neural: a small inherited neural network decides where to swim.", ru: "Нейросеть: маленькая наследуемая нейросеть решает, куда плыть." },
    "swims": { en: "How hard it swims (from its brain). Faster costs more energy.", ru: "Как сильно гребёт (решает мозг). Быстрее — дороже по энергии." },
    "climate pull": { en: "How strongly it swims towards water of its favourite temperature.", ru: "Насколько сильно тянется к воде любимой температуры." },
    "company": { en: "Whether it keeps near others (a school) or away from them.", ru: "Держится ли рядом с другими (стайка) или подальше от них." },
    "food preferred": { en: "Classic pools: the plant colour it swims to.", ru: "Классические бассейны: к растениям какого цвета плывёт." },
    "food digested best": { en: "Classic pools: the plant colour it gets most energy from.", ru: "Классические бассейны: из растений какого цвета получает больше энергии." },
    "sick": { en: "Sick swimbots have pale spots, lose energy every step and can be caught by a predator of any size. Those who got well do not catch the same disease again.",
              ru: "У больных бледные пятна, они теряют энергию каждый шаг, их может поймать хищник любого размера. Переболевший не заражается той же болезнью снова." },
    "eats young": { en: "An inherited gene: whether a grown-up may eat the young of other families (never its own kin) when hungry and the young one fits in its mouth.",
                    ru: "Наследуемый ген: может ли взрослый съесть детёныша чужой семьи (своих — никогда), когда голоден и детёныш помещается в рот." },
    "kind": { en: "Herbivore or predator, and its predator level (0–1, inherited). Predators hunt live swimbots and eat meat; herbivores eat plants.",
              ru: "Травоядное или хищник, и уровень хищника (0–1, наследуется). Хищники охотятся на живых и едят мясо, травоядные едят растения." },
    // tweak tab
    "food growth delay": { en: "Steps between new plants growing: bigger means less food in the pool.", ru: "Сколько шагов между появлением новых растений: больше — меньше еды в бассейне." },
    "food spread": { en: "How far from its parent plant a new plant grows: small values make dense patches.", ru: "Как далеко от родительского растения вырастает новое: маленькое значение — густые заросли." },
    "food bit energy": { en: "How much energy one plant gives.", ru: "Сколько энергии даёт одно растение." },
    "maximum age": { en: "The longest a swimbot can live (in steps); then it dies of old age.", ru: "Сколько шагов свимбот может прожить, потом умирает от старости." },
    "population limit": { en: "When off, the pool can use its four-times population reserve. This needs more memory and computing power.", ru: "Когда выключен, бассейн может использовать четырёхкратный резерв популяции. Это требует больше памяти и вычислительной мощности." },
    "maximum body parts": { en: "The largest body a newly grown swimbot can have, from 2 to 64. Existing bodies keep their current form.", ru: "Наибольшее число члеников у вновь выращиваемого свимбота: от 2 до 64. Уже существующие тела не перестраиваются." },
};

// the "?" of a hint key
export function hintMark( key: string ): string
{
    return HINTS[ key ] ? "<span class='hintMark' data-hint-key='" + key + "' tabindex='0'>?</span>" : "";
}

//------------------------------------------------------------
// the swimbot card (English HTML from the simulation thread):
// translated, and every row with its "?"
//------------------------------------------------------------
export function decorateSwimbotCard( container: HTMLElement )
{
    container.querySelectorAll( ".swimbotTable td:first-child" ).forEach( ( td: any ) =>
    {
        const en = td.textContent.trim();
        td.innerHTML = "<span class='hintLabel'>" + tr( en ) + hintMark( en ) + "</span>";
        const value = td.nextElementSibling;
        if ( value ) value.innerHTML = translateHTML( value.innerHTML );
    });
    const kind = container.querySelector( ".swimbotKind" ) as HTMLElement;
    if ( kind ) kind.innerHTML = "<span class='hintLabel'>" + translateHTML( kind.innerHTML ) + hintMark( "kind" ) + "</span>";
}

//------------------------------------------------------------
// the static texts of the page
//------------------------------------------------------------
const _english = new WeakMap<Node, string>();
const _englishTitle = new WeakMap<Element, string>();

export function translatePage()
{
    const roots = [ "masterPanel", "helpOverlay", "noRenderPanel", "panelToggleButton", "dataDisplayButton" ].map( id => document.getElementById( id )).filter( Boolean ) as HTMLElement[];
    for ( const root of roots )
    {
        // (the parts filled by the code are translated when they are filled)
        const skip = ( n: Node ) => !!( n.parentElement && n.parentElement.closest( "#swimbotDataPanel, #graphData, #infoText, #hud, #noRenderStats, .userSwimbotName" ));
        const walker = document.createTreeWalker( root, NodeFilter.SHOW_TEXT );
        for ( let n = walker.nextNode(); n; n = walker.nextNode() )
        {
            if ( skip( n ) || !n.nodeValue || !n.nodeValue.trim() ) continue;
            if ( !_english.has( n )) _english.set( n, n.nodeValue );
            n.nodeValue = tr( _english.get( n )! );
        }
        const titled = [ root, ...Array.from( root.querySelectorAll( "[title]" )) ];
        titled.forEach( ( e ) =>
        {
            if ( !e.hasAttribute( "title" )) return;
            if ( !_englishTitle.has( e )) _englishTitle.set( e, e.getAttribute( "title" )! );
            e.setAttribute( "title", tr( _englishTitle.get( e )! ));
        });
    }
    document.documentElement.lang = _lang;
    const button = document.getElementById( "langButton" );
    if ( button ) button.innerHTML = _lang === "en" ? "<b>EN</b> · RU" : "EN · <b>RU</b>";
}

export function toggleLanguage()
{
    _lang = ( _lang === "en" ) ? "ru" : "en";
    try { localStorage.setItem( "genepool.lang", _lang ); } catch ( e ) { /* (no storage) */ }
    translatePage();
    window.dispatchEvent( new Event( "genepool:language" ));
}

//------------------------------------------------------------
// the hint bubble: one for the page, shown next to the "?" pointed at
//------------------------------------------------------------
export function setupHints()
{
    const bubble = document.createElement( "div" );
    bubble.id = "hintBubble";
    document.body.appendChild( bubble );
    let pinned: HTMLElement | null = null;

    const show = ( mark: HTMLElement ) =>
    {
        const hint = HINTS[ mark.dataset.hintKey || "" ];
        if ( !hint ) return;
        bubble.textContent = hint[ _lang ];
        bubble.classList.add( "shown" );
        const r = mark.getBoundingClientRect();
        const w = Math.min( 280, window.innerWidth - 16 );
        bubble.style.width = w + "px";
        let left = r.right - w;
        left = Math.max( 8, Math.min( window.innerWidth - w - 8, left ));
        bubble.style.left = left + "px";
        const below = r.bottom + 6;
        bubble.style.top = below + "px";
        // (no room below: above)
        const h = bubble.offsetHeight;
        if ( below + h > window.innerHeight - 8 ) bubble.style.top = Math.max( 8, r.top - h - 6 ) + "px";
    };
    const hide = () => { bubble.classList.remove( "shown" ); };

    document.addEventListener( "mouseover", ( e ) =>
    {
        const mark = ( e.target as HTMLElement ).closest?.( ".hintMark" ) as HTMLElement;
        if ( mark ) show( mark ); else if ( !pinned ) hide();
    });
    document.addEventListener( "click", ( e ) =>
    {
        const mark = ( e.target as HTMLElement ).closest?.( ".hintMark" ) as HTMLElement;
        if ( mark ) { pinned = ( pinned === mark ) ? null : mark; if ( pinned ) show( mark ); else hide(); e.stopPropagation(); return; }
        pinned = null; hide();
    }, true );
    document.addEventListener( "focusin", ( e ) => { const t = e.target as HTMLElement; if ( t.classList && t.classList.contains( "hintMark" )) show( t ); });
    document.addEventListener( "focusout", () => { if ( !pinned ) hide(); });

    // the static marks: elements with data-hint="key"
    document.querySelectorAll( "[data-hint]" ).forEach( ( e ) =>
    {
        e.insertAdjacentHTML( "beforeend", hintMark(( e as HTMLElement ).dataset.hint! ));
    });
}

