// 歴史上の人物によるダミー人名データ。実在の現代人とは一切紐づかない。
// 顧客・家族・スタッフの氏名はすべてここから採る。

export interface PlaceSeed {
  city: string;
  address: string;
  lat: number;
  lng: number;
}

// 実在する地名(緯度経度は概ね妥当な値)。個人情報とは紐づかないダミー住所として使用。
export const PLACES: PlaceSeed[] = [
  { city: "文京区", address: "東京都文京区本郷3-1-1", lat: 35.7081, lng: 139.7622 },
  { city: "京都市", address: "京都府京都市上京区烏丸通今出川上る", lat: 35.0322, lng: 135.7601 },
  { city: "仙台市", address: "宮城県仙台市青葉区青葉城址1-1", lat: 38.2534, lng: 140.8564 },
  { city: "鹿児島市", address: "鹿児島県鹿児島市城山町7-2", lat: 31.5966, lng: 130.5544 },
  { city: "萩市", address: "山口県萩市堀内", lat: 34.4084, lng: 131.3993 },
  { city: "高知市", address: "高知県高知市upper 追手筋2-1-1", lat: 33.5597, lng: 133.5311 },
  { city: "会津若松市", address: "福島県会津若松市追手町1-1", lat: 37.4939, lng: 139.9298 },
  { city: "金沢市", address: "石川県金沢市丸の内1-1", lat: 36.5613, lng: 136.6562 },
  { city: "松阪市", address: "三重県松阪市殿町1-1", lat: 34.5776, lng: 136.5266 },
  { city: "岡崎市", address: "愛知県岡崎市康生町561", lat: 34.9536, lng: 137.1749 },
  { city: "名古屋市", address: "愛知県名古屋市中区本丸1-1", lat: 35.1856, lng: 136.8997 },
  { city: "小田原市", address: "神奈川県小田原市城内6-1", lat: 35.2531, lng: 139.1544 },
  { city: "米沢市", address: "山形県米沢市丸の内1-2-1", lat: 37.9147, lng: 140.1167 },
  { city: "長崎市", address: "長崎県長崎市南山手町", lat: 32.7364, lng: 129.8656 },
  { city: "堺市", address: "大阪府堺市堺区南旅篭町東", lat: 34.5733, lng: 135.4830 },
  { city: "大阪市", address: "大阪府大阪市中央区大阪城1-1", lat: 34.6873, lng: 135.5262 },
  { city: "彦根市", address: "滋賀県彦根市金亀町1-1", lat: 35.2745, lng: 136.2597 },
  { city: "姫路市", address: "兵庫県姫路市本町68", lat: 34.8394, lng: 134.6939 },
  { city: "松本市", address: "長野県松本市丸の内4-1", lat: 36.2381, lng: 137.9686 },
  { city: "弘前市", address: "青森県弘前市下白銀町1-1", lat: 40.6073, lng: 140.4638 },
];

export interface FigureSeed {
  name: string;
  gender: "m" | "f";
  birthYear: number; // 生年月日生成用の目安(西暦, ダミー)
  job: string;
}

// 顧客(利用者本人)用の人物プール
export const CUSTOMER_FIGURES: FigureSeed[] = [
  { name: "徳川家康", gender: "m", birthYear: 1543, job: "無職(隠居)" },
  { name: "豊臣秀吉", gender: "m", birthYear: 1537, job: "会社役員" },
  { name: "織田信長", gender: "m", birthYear: 1534, job: "会社経営" },
  { name: "石田三成", gender: "m", birthYear: 1560, job: "公務員" },
  { name: "上杉謙信", gender: "m", birthYear: 1530, job: "自営業" },
  { name: "武田信玄", gender: "m", birthYear: 1521, job: "会社員" },
  { name: "明智光秀", gender: "m", birthYear: 1528, job: "会社員" },
  { name: "前田利家", gender: "m", birthYear: 1539, job: "会社役員" },
  { name: "紫式部", gender: "f", birthYear: 973, job: "作家" },
  { name: "清少納言", gender: "f", birthYear: 966, job: "作家" },
  { name: "北条政子", gender: "f", birthYear: 1157, job: "会社役員" },
  { name: "淀殿", gender: "f", birthYear: 1569, job: "無職" },
  { name: "伊達政宗", gender: "m", birthYear: 1567, job: "会社経営" },
  { name: "坂本龍馬", gender: "m", birthYear: 1836, job: "会社員" },
  { name: "西郷隆盛", gender: "m", birthYear: 1828, job: "公務員" },
  { name: "勝海舟", gender: "m", birthYear: 1823, job: "会社役員" },
  { name: "土方歳三", gender: "m", birthYear: 1835, job: "会社員" },
  { name: "樋口一葉", gender: "f", birthYear: 1872, job: "作家" },
  { name: "与謝野晶子", gender: "f", birthYear: 1878, job: "作家" },
  { name: "夏目漱石", gender: "m", birthYear: 1867, job: "会社員(教員)" },
  { name: "レオナルド・ダ・ヴィンチ", gender: "m", birthYear: 1452, job: "自営業(芸術家)" },
  { name: "ナイチンゲール", gender: "f", birthYear: 1820, job: "看護師(退職)" },
  { name: "クレオパトラ", gender: "f", birthYear: -69, job: "会社経営" },
  { name: "ジャンヌ・ダルク", gender: "f", birthYear: 1412, job: "公務員" },
];

// 家族用の人物プール(顧客とは別の氏名で世帯を作る)
export const FAMILY_FIGURES: FigureSeed[] = [
  { name: "徳川秀忠", gender: "m", birthYear: 2018, job: "" },
  { name: "淀君", gender: "f", birthYear: 1990, job: "パート" },
  { name: "豊臣秀頼", gender: "m", birthYear: 2020, job: "" },
  { name: "織田信忠", gender: "m", birthYear: 2016, job: "" },
  { name: "濃姫", gender: "f", birthYear: 1992, job: "会社員" },
  { name: "石田重家", gender: "m", birthYear: 2019, job: "" },
  { name: "上杉景勝", gender: "m", birthYear: 2015, job: "" },
  { name: "武田勝頼", gender: "m", birthYear: 2017, job: "" },
  { name: "明智玉(細川ガラシャ)", gender: "f", birthYear: 1988, job: "会社員" },
  { name: "まつ", gender: "f", birthYear: 1991, job: "パート" },
  { name: "藤原宣孝", gender: "m", birthYear: 1985, job: "会社員" },
  { name: "橘則光", gender: "m", birthYear: 1987, job: "自営業" },
  { name: "源頼家", gender: "m", birthYear: 2014, job: "" },
  { name: "豊臣国松", gender: "m", birthYear: 2021, job: "" },
  { name: "伊達忠宗", gender: "m", birthYear: 2013, job: "" },
  { name: "坂本直", gender: "f", birthYear: 1993, job: "会社員" },
  { name: "西郷菊次郎", gender: "m", birthYear: 2012, job: "" },
  { name: "勝小鹿", gender: "m", birthYear: 2011, job: "" },
  { name: "樋口邦子", gender: "f", birthYear: 2020, job: "" },
  { name: "与謝野光", gender: "m", birthYear: 2018, job: "" },
  { name: "夏目筆子", gender: "f", birthYear: 2019, job: "" },
];

export const ALLERGIES = ["特になし", "卵アレルギー", "乳製品アレルギー", "そばアレルギー", "甲殻類アレルギー", "花粉症"];
export const FAMILY_INFO_NOTES = [
  "人見知りが少しあります。",
  "元気いっぱいで活発です。",
  "絵本の読み聞かせが好きです。",
  "お昼寝の時間を大事にしています。",
  "外遊びが大好きです。",
  "",
];

// スタッフ用の人物プール(管理者1名を含む)
export const STAFF_FIGURES: (FigureSeed & { isAdmin: boolean })[] = [
  { name: "徳川吉宗", gender: "m", birthYear: 1684, job: "", isAdmin: true },
  { name: "新井白石", gender: "m", birthYear: 1657, job: "", isAdmin: false },
  { name: "杉田玄白", gender: "m", birthYear: 1733, job: "", isAdmin: false },
  { name: "緒方洪庵", gender: "m", birthYear: 1810, job: "", isAdmin: false },
  { name: "津田梅子", gender: "f", birthYear: 1864, job: "", isAdmin: false },
  { name: "野口英世", gender: "m", birthYear: 1876, job: "", isAdmin: false },
  { name: "マリー・キュリー", gender: "f", birthYear: 1867, job: "", isAdmin: false },
  { name: "アメリア・イアハート", gender: "f", birthYear: 1897, job: "", isAdmin: false },
  { name: "北里柴三郎", gender: "m", birthYear: 1853, job: "", isAdmin: false },
];
