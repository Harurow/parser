import { sanitizeHtml, SanitizeOptions } from "./SanitizeParser";

function decodeEntities(input: string): string {
  return (
    input
      // 数値実体（10進）
      .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      // 数値実体（16進）
      .replace(/&#x([0-9a-fA-F]+);?/g, (_, h) =>
        String.fromCodePoint(parseInt(h, 16))
      )
      // Unicode エスケープ（\uXXXX）
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
        String.fromCodePoint(parseInt(h, 16))
      )
      // Unicode エスケープ（\u{1F600} のような形式）
      .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) =>
        String.fromCodePoint(parseInt(h, 16))
      )
      // よく使う実体
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
  );
}

function sanitizeHref(raw: string): string | null {
  if (raw === "") return ""; // 空文字は許可

  const decoded = decodeEntities(raw);

  // 制御文字チェック
  if (/[\u0000-\u001F\u007F]/.test(decoded)) return null;

  // スキーム判定用にコロン前を抽出
  const schemeMatch = decoded.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme === "http" || scheme === "https") {
      // コロン前に空白が混ざっていたら NG
      if (/\s/.test(decoded.slice(0, schemeMatch[0].length))) return null;
      // パスなどの空白は %20 に置換
      return decoded.replace(/ /g, "%20");
    }
    return null; // 未知スキームは削除
  }

  // 相対 URL の場合も空白を %20 に変換
  return decoded.replace(/ /g, "%20");
}

const option: SanitizeOptions = {
  allowedTags: [
    { tagName: "strong" },
    { tagName: "u" },
    { tagName: "ul" },
    { tagName: "li" },
    { tagName: "br" },
    {
      tagName: "font",
      onAttribute: (name, _) => {
        if (name === "color" || name === "size" || name === "face") {
          return true;
        }
        return false;
      },
    },
    {
      tagName: "a",
      onAttribute: (name, value) => {
        if (name === "href") {
          try {
            const sanitizeHrefed = sanitizeHref(value);
            if (sanitizeHrefed === null) return false;
            const url = new URL(sanitizeHrefed, window.location.origin);
            return (
              (url.protocol === "http:" || url.protocol === "https:") &&
              !/[\r\n]/g.test(value)
            );
          } catch {
            return false;
          }
        } else if (name === "target" || name === "rel") {
          return true;
        }
        return false;
      },
      defaultAttributes: { target: "_blank", rel: "noopener noreferrer" },
    },
  ],
};

// testCases.ts (1/5) — 1..100
export const testCases: [string, string, string][] = [
  // --- 1. 基本許可タグ & br 正規化 ---
  ["001 strong 基本", "<strong>abc</strong>", "<strong>abc</strong>"],
  ["002 u 基本", "<u>abc</u>", "<u>abc</u>"],
  [
    "003 ul-li 基本",
    "<ul><li>1</li><li>2</li></ul>",
    "<ul><li>1</li><li>2</li></ul>",
  ],
  ["004 br 非自己終了は保持", "a<br>b", "a<br>b"],
  ["005 br 自己終了 正規化", "a<br/>b", "a<br />b"],
  ["006 br 自己終了 空白 正規化", "a<br   />b", "a<br />b"],
  ["007 br 大小混在 非自己終了は保持", "a<BR>b", "a<BR>b"],
  ["008 br 大小混在 自己終了は正規化", "a<Br/>b", "a<Br />b"],

  // --- 2. font（size, color, face 許可。他は削除） ---
  [
    "009 font 許可属性 size/color/face",
    '<font size="3" color="red" face="Arial">x</font>',
    '<font size="3" color="red" face="Arial">x</font>',
  ],
  [
    "010 font 不許可属性削除",
    '<font style="x" size="5" face="Meiryo">x</font>',
    '<font size="5" face="Meiryo">x</font>',
  ],
  [
    "011 font 許可外複数削除",
    '<font data-a="1" onclick="e" color="#fff" face="Noto Sans">y</font>',
    '<font color="#fff" face="Noto Sans">y</font>',
  ],
  ["012 font 属性なし", "<font>abc</font>", "<font>abc</font>"],
  [
    "013 font 大小混在属性",
    '<font SIZE="4" COLOR="Green" FACE="Serif">y</font>',
    '<font SIZE="4" COLOR="Green" FACE="Serif">y</font>',
  ],
  [
    "014 font 不正値保持方針",
    '<font size="huge" color="red" face="X">x</font>',
    '<font size="huge" color="red" face="X">x</font>',
  ],
  [
    "015 font 内 br 正規化",
    '<font size="3" face="A">a<br/>b</font>',
    '<font size="3" face="A">a<br />b</font>',
  ],

  // --- 3. 不許可タグは文字列化（<, > エスケープ。& はそのまま。 "→&quot; '→&#39;） ---
  ["016 div 文字列化", "<div>abc</div>", "&lt;div&gt;abc&lt;/div&gt;"],
  ["017 span 文字列化", "<span>x</span>", "&lt;span&gt;x&lt;/span&gt;"],
  [
    "018 script 文字列化",
    "<script>alert(1)</script>",
    "&lt;script&gt;alert(1)&lt;/script&gt;",
  ],
  [
    '019 style 文字列化（" エスケープ）',
    '<style>body{font:"A"}</style>',
    "&lt;style&gt;body{font:&quot;A&quot;}&lt;/style&gt;",
  ],
  [
    "020 iframe 文字列化（属性のクォート中は非エスケープだが文字列化で &quot;）",
    '<iframe src="x"></iframe>',
    "&lt;iframe src=&quot;x&quot;&gt;&lt;/iframe&gt;",
  ],
  [
    "021 img 文字列化（'→&#39;）",
    "<img alt='x'>",
    "&lt;img alt=&#39;x&#39;&gt;",
  ],
  [
    "022 svg 文字列化",
    "<svg><circle/></svg>",
    "&lt;svg&gt;&lt;circle/&gt;&lt;/svg&gt;",
  ],
  [
    "023 math 文字列化",
    "<math><mrow></mrow></math>",
    "&lt;math&gt;&lt;mrow&gt;&lt;/mrow&gt;&lt;/math&gt;",
  ],
  ["024 video 文字列化", "<video>v</video>", "&lt;video&gt;v&lt;/video&gt;"],
  ["025 audio 文字列化", "<audio>a</audio>", "&lt;audio&gt;a&lt;/audio&gt;"],

  // --- 4. a（href/target/rel）。href: http/https/相対/空文字は許可。その他は削除 ---
  [
    "026 a デフォルト付与（中身あり）",
    "<a>abc</a>",
    '<a target="_blank" rel="noopener noreferrer">abc</a>',
  ],
  [
    "027 a デフォルト付与（中身なし）",
    "<a></a>",
    '<a target="_blank" rel="noopener noreferrer"></a>',
  ],
  [
    "028 a http 許可",
    '<a href="http://example.com">x</a>',
    '<a href="http://example.com" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "029 a https 許可",
    '<a href="https://example.com">x</a>',
    '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "030 a 相対 許可",
    '<a href="/page">x</a>',
    '<a href="/page" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "031 a 空文字 href 許可（削除しない）",
    '<a href="">x</a>',
    '<a href="" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "032 a javascript 不許可（href除去）",
    '<a href="javascript:alert(1)">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "033 a data 不許可（href除去）",
    '<a href="data:text/html,aaa">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "034 a mailto 不許可（href除去）",
    '<a href="mailto:a@b.com">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "035 a ftp 不許可（href除去）",
    '<a href="ftp://host">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "036 a file 不許可（href除去）",
    '<a href="file:///etc/passwd">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "037 a vbscript 不許可（href除去）",
    '<a href="vbscript:evil()">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],

  // --- 5. a 属性の大小・順序・改行・クォート ---
  [
    "038 a 属性順序保持（想定）",
    '<a target="_self" href="http://ex" rel="noreferrer">x</a>',
    '<a target="_self" href="http://ex" rel="noreferrer">x</a>',
  ],
  [
    "039 a 属性大小混在（既存属性はそのまま）",
    '<A HREF="http://ex.com" TARGET="_top">x</A>',
    '<A HREF="http://ex.com" TARGET="_top" rel="noopener noreferrer">x</A>',
  ],
  [
    "040 a 改行入り属性",
    '<a\nhref="https://ex.com">x</a>',
    '<a href="https://ex.com" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    '041 a 無クォート属性 → "で囲む',
    "<a href=http://ex.com>x</a>",
    '<a href="http://ex.com" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    '042 a 無クォート + 値内の " は \\"',
    '<a href=http://ex.com/?q="a">x</a>',
    '<a href="http://ex.com/?q=\\"a\\"" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "043 a シングルクォート属性はそのまま",
    "<a href='https://ex.com'>x</a>",
    '<a href=\'https://ex.com\' target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "044 a ダブルクォート属性内の ' はそのまま（属性値内は非エスケープ）",
    "<a href=\"http://ex.com/?q='a'\">x</a>",
    '<a href="http://ex.com/?q=\'a\'" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    '045 a シングルクォート属性内の " はそのまま（属性値内は非エスケープ）',
    "<a href='http://ex.com/?q=\"a\"'>x</a>",
    '<a href=\'http://ex.com/?q="a"\' target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "046 a href に < を含む（保持）",
    '<a href="http://a.com/?q=<s>">x</a>',
    '<a href="http://a.com/?q=<s>" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "047 a href に & を含む（& はそのまま）",
    '<a href="http://a.com/?a=1&b=2">x</a>',
    '<a href="http://a.com/?a=1&b=2" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "048 a href 値なし属性（存在のみ）→ href を保持",
    "<a href>y</a>",
    '<a href target="_blank" rel="noopener noreferrer">y</a>',
  ],

  // --- 6. href エンティティ・改行混入回避 ---
  [
    "049 href エンティティ混合1（jav&#x61;script）",
    '<a href="jav&#x61;script:1">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "050 href エンティティ混合2（java&#115;cript）",
    '<a href="java&#115;cript:alert(1)">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "051 href 改行混入 http",
    '<a href="http:\n//ex.com">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "052 href 改行混入 https",
    '<a href="https:\n//ex.com">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "053 href 相対 + クエリ",
    '<a href="/p?q=1&x=2">x</a>',
    '<a href="/p?q=1&x=2" target="_blank" rel="noopener noreferrer">x</a>',
  ],

  // --- 7. br 追加バリエーション ---
  ["054 <Br/ > → <Br />", "<Br/ >", "<Br />"],
  ["055 連続 br（混在）", "<br><br/><BR   />", "<br><br /><BR />"],
  ["056 br 属性削除", '<br class="x">', "<br>"],
  ["057 br 自己終了 + 属性削除", '<br class="x" />', "<br />"],
  ["058 br タブ混入自己終了 正規化", "x<br\t/>y", "x<br />y"],
  ["059 br 改行直後 自己終了 正規化", "x\n<br/>y", "x\n<br />y"],

  // --- 8. 許可タグの属性削除（strong/u/ul/li） + ネスト ---
  [
    "060 strong 属性削除",
    '<strong id="x" class="y">a</strong>',
    "<strong>a</strong>",
  ],
  ["061 u 属性削除", '<u onclick="evil()">a</u>', "<u>a</u>"],
  ["062 ul 属性削除", '<ul data-x="1">a</ul>', "<ul>a</ul>"],
  ["063 li 属性削除", '<li style="c">a</li>', "<li>a</li>"],
  [
    "064 強調ネスト + 属性削除",
    '<strong id="1"><u class="x">a</u></strong>',
    "<strong><u>a</u></strong>",
  ],
  [
    "065 ul-li 複合（liの属性削除）",
    '<ul><li class="x">a</li><li id="y">b</li></ul>',
    "<ul><li>a</li><li>b</li></ul>",
  ],
  [
    "066 許可タグ内に br 正規化",
    "<strong>a<br/>b</strong>",
    "<strong>a<br />b</strong>",
  ],
  [
    "067 許可タグ内 font（許可外属性削除）",
    '<u><font size="3" face="A" onclick="x">x</font></u>',
    '<u><font size="3" face="A">x</font></u>',
  ],
  [
    "068 許可タグ内 a（javascript 除去）",
    '<strong><a href="javascript:x">y</a></strong>',
    '<strong><a target="_blank" rel="noopener noreferrer">y</a></strong>',
  ],
  [
    "069 許可タグ内 不許可タグ（文字列化）",
    "<strong><div>x</div></strong>",
    "<strong>&lt;div&gt;x&lt;/div&gt;</strong>",
  ],

  // --- 9. 未知/壊れタグ・角括弧の扱い（半端な > は &gt;） ---
  ["070 未知タグ 文字列化", "<xyz>t</xyz>", "&lt;xyz&gt;t&lt;/xyz&gt;"],
  ["071 開始だけ未知タグ", "<custom>", "&lt;custom&gt;"],
  ["072 閉じだけ未知タグ", "</custom>", "&lt;/custom&gt;"],
  ["073 半端な < を文字列化", "a < b", "a &lt; b"],
  ["074 半端な > は &gt;", "a > b", "a &gt; b"],
  [
    '075 タグ風文字列に " を含む（文字列化で &quot;）',
    '< notatag attr="v" >',
    "&lt; notatag attr=&quot;v&quot; &gt;",
  ],
  [
    "076 タグ風文字列に ' を含む（文字列化で &#39;）",
    "< notatag attr='v' >",
    "&lt; notatag attr=&#39;v&#39; &gt;",
  ],
  [
    "077 a タグに壊れた属性（<a <b>>）→ <b は不要属性として削除、余剰 > はテキスト → &gt;",
    "<a <b>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "078 引用符不整合（a として継続、href破損は除去）",
    '<a href="http://ex>">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  ["079 タグ未閉じ（許可タグ）", "<strong>abc", "<strong>abc"],
  ["080 タグ未開（許可タグ閉じのみ）", "abc</strong>", "abc</strong>"],
  [
    "081 山括弧ダブル（内側 a にデフォルト付与）",
    "<<a>>",
    '&lt;<a target="_blank" rel="noopener noreferrer">&gt;',
  ],

  // --- 10. コメント/Doctype/CDATAs は文字列化（\" ' エスケープ） ---
  ["082 HTMLコメント", "<!-- hello -->", "&lt;!-- hello --&gt;"],
  [
    "083 条件付きコメント",
    "<!--[if IE]>x<![endif]-->",
    "&lt;!--[if IE]&gt;x&lt;![endif]--&gt;",
  ],
  [
    "084 コメント 入れ子風",
    "<!-- a <!-- b --> c -->",
    "&lt;!-- a &lt;!-- b --&gt; c --&gt;",
  ],
  ["085 DOCTYPE 文字列化", "<!DOCTYPE html>", "&lt;!DOCTYPE html&gt;"],
  ["086 CDATA 文字列化", "<![CDATA[ x ]]>", "&lt;![CDATA[ x ]]&gt;"],

  // --- 11. テキスト中の \" と ' はエンティティ化（& は非エスケープ、> は &gt;） ---
  [
    '087 テキスト中の " → &quot;',
    'He said "Hello"',
    "He said &quot;Hello&quot;",
  ],
  ["088 テキスト中の ' → &#39;", "It’s fine", "It’s fine"], // ’ はそのまま（HTML実体化しない）
  [
    "089 テキストに両方混在 + > も &gt;",
    `He said "It's > fine"`,
    "He said &quot;It&#39;s &gt; fine&quot;",
  ],
  ["090 & は非エスケープ", "Tom & Jerry", "Tom & Jerry"],
  ["091 既存 &lt; はそのまま", "1 &lt; 2", "1 &lt; 2"],
  ["092 既存 &amp; はそのまま", "A &amp; B", "A &amp; B"],

  // --- 12. a の rel/target デフォルト付与の整合チェック ---
  [
    "093 a rel 既存 + target 付与",
    '<a href="http://ex" rel="nofollow">x</a>',
    '<a href="http://ex" rel="nofollow" target="_blank">x</a>',
  ],
  [
    "094 a target 既存 + rel 付与",
    '<a href="http://ex" target="_self">x</a>',
    '<a href="http://ex" target="_self" rel="noopener noreferrer">x</a>',
  ],
  [
    "095 a rel/target 既存（変更なし）",
    '<a href="http://ex" target="_top" rel="external">x</a>',
    '<a href="http://ex" target="_top" rel="external">x</a>',
  ],

  // --- 13. 属性クォート規則の厳密確認 ---
  [
    '096 無クォート属性 ラップ + \\"',
    '<a href=http://ex.com/?q="v">x</a>',
    '<a href="http://ex.com/?q=\\"v\\"" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "097 シングルクォート属性は維持",
    "<a href='http://ex.com'>x</a>",
    '<a href=\'http://ex.com\' target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "098 ダブルクォート属性内の ' は非エスケープ（属性値内）",
    "<a href=\"http://ex.com/?q='v'\">x</a>",
    '<a href="http://ex.com/?q=\'v\'" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    '099 シングルクォート属性内の " は非エスケープ（属性値内）',
    "<a href='http://ex.com/?q=\"v\"'>x</a>",
    '<a href=\'http://ex.com/?q="v"\' target="_blank" rel="noopener noreferrer">x</a>',
  ],

  // --- 14. テキストとタグ混在の > エスケープ最終確認 ---
  [
    "100 テキストの > は常に &gt;",
    "a<br> b > c <strong>d</strong>",
    "a<br> b &gt; c <strong>d</strong>",
  ],
  [
    "101 strong 内に a（http 許可）",
    '<strong><a href="http://ok">x</a></strong>',
    '<strong><a href="http://ok" target="_blank" rel="noopener noreferrer">x</a></strong>',
  ],
  [
    "102 strong 内に a（javascript 除去）",
    '<strong><a href="javascript:x">y</a></strong>',
    '<strong><a target="_blank" rel="noopener noreferrer">y</a></strong>',
  ],
  [
    "103 u 内に font 許可属性のみ",
    '<u><font size="3" color="red" face="A" style="x">t</font></u>',
    '<u><font size="3" color="red" face="A">t</font></u>',
  ],
  [
    "104 ul/li 深いネスト + 属性削除",
    '<ul data-x="1"><li id="i1">a<ul class="c"><li style="s">b</li></ul></li></ul>',
    "<ul><li>a<ul><li>b</li></ul></li></ul>",
  ],
  [
    "105 br 連続（自己/非自己混在）",
    "a<br><br/><br   />b",
    "a<br><br /><br />b",
  ],
  ["106 br 大文字混在", "a<BR/>b<Br>c", "a<BR />b<Br>c"],
  [
    "107 a 相対（?query）",
    '<a href="?q=1&x=2">k</a>',
    '<a href="?q=1&x=2" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "108 a 相対（#hash）",
    '<a href="#top">k</a>',
    '<a href="#top" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "109 a 相対（./path）",
    '<a href="./p">k</a>',
    '<a href="./p" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "110 a 相対（../path）",
    '<a href="../p">k</a>',
    '<a href="../p" target="_blank" rel="noopener noreferrer">k</a>',
  ],

  // 属性クォート挙動の強化
  [
    '111 a 無クォート + 空白あり → 出力はダブルクォートで囲み、内部 " は \\"',
    '<a href=http://ex.com/?q= a "b">t</a>',
    '<a href="http://ex.com/?q=" target="_blank" rel="noopener noreferrer">t</a>',
  ],

  [
    "112 a シングルクォート属性は維持（内部 ' も維持）",
    "<a href='http://e.com/?q='v''>t</a>",
    "<a href='http://e.com/?q=' target=\"_blank\" rel=\"noopener noreferrer\">t</a>",
  ],

  [
    "113 a ダブルクォート属性（内部 ' はそのまま）",
    "<a href=\"http://e.com/?q='v'\">t</a>",
    '<a href="http://e.com/?q=\'v\'" target="_blank" rel="noopener noreferrer">t</a>',
  ],

  [
    '114 a ダブルクォート属性（内部 " はそのまま）',
    '<a href="http://e.com/?q="v"">t</a>',
    '<a href="http://e.com/?q=" target="_blank" rel="noopener noreferrer">t</a>',
  ],

  [
    "115 a 無クォートで > を含む → テキスト > は &gt;",
    "<a href=http://a.com/?x>y>z>t</a>",
    '<a href="http://a.com/?x" target="_blank" rel="noopener noreferrer">y&gt;z&gt;t</a>',
  ],

  // href 文字参照回避や分断
  [
    "116 href 分断（ja va script:）",
    '<a href="ja va script:1">x</a>',
    '<a href="ja va script:1" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "117 href 分断（ja\\nva script:）",
    '<a href="ja\nva script:1">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "118 href 制御文字混ぜ（jav\\u0000ascript:）",
    '<a href="jav\u0000ascript:1">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "119 href 大小混在（JaVaScRiPt:）",
    '<a href="JaVaScRiPt:1">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "120 href data:image/svg+xml",
    '<a href="data:image/svg+xml,<svg>">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],

  // href の境界（相対っぽいが : を含む）
  [
    "121 相対風（path:with-colon）→ 未知スキームは削除",
    '<a href="path:with-colon">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "122 相対風（./p:a）",
    '<a href="./p:a">x</a>',
    '<a href="./p:a" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "123 相対風（../p:a）",
    '<a href="../p:a">x</a>',
    '<a href="../p:a" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "124 相対風（?q=a:b）",
    '<a href="?q=a:b">x</a>',
    '<a href="?q=a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "125 相対風（#f:a）",
    '<a href="#f:a">x</a>',
    '<a href="#f:a" target="_blank" rel="noopener noreferrer">x</a>',
  ],

  // a の既存 rel/target 維持系
  [
    "126 a rel 既存のみ（target 付与）",
    '<a href="http://e" rel="ext">x</a>',
    '<a href="http://e" rel="ext" target="_blank">x</a>',
  ],
  [
    "127 a target 既存のみ（rel 付与）",
    '<a href="http://e" target="_self">x</a>',
    '<a href="http://e" target="_self" rel="noopener noreferrer">x</a>',
  ],
  [
    "128 a rel/target 両方既存",
    '<a href="http://e" target="_top" rel="nofollow">x</a>',
    '<a href="http://e" target="_top" rel="nofollow">x</a>',
  ],
  [
    "129 a 不許可属性混在（保持しない）",
    '<a href="http://e" data-x="1" onclick="y">x</a>',
    '<a href="http://e" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "130 a href 値なし属性（保持）",
    "<a href>y</a>",
    '<a href target="_blank" rel="noopener noreferrer">y</a>',
  ],

  // 不許可タグの文字列化（" と ' を文字列内でエスケープ）
  [
    '131 script 内に " を含む',
    '<script>var s="x";</script>',
    "&lt;script&gt;var s=&quot;x&quot;;&lt;/script&gt;",
  ],
  [
    "132 script 内に ' を含む",
    "<script>var s='x';</script>",
    "&lt;script&gt;var s=&#39;x&#39;;&lt;/script&gt;",
  ],
  [
    "133 iframe 属性に '",
    "<iframe src='x'></iframe>",
    "&lt;iframe src=&#39;x&#39;&gt;&lt;/iframe&gt;",
  ],
  [
    "134 svg onload 文字列化",
    '<svg onload="a()">x</svg>',
    "&lt;svg onload=&quot;a()&quot;&gt;x&lt;/svg&gt;",
  ],
  [
    "135 style 文字列化で > も &gt;",
    "<style>a>b</style>",
    "&lt;style&gt;a&gt;b&lt;/style&gt;",
  ],

  // テキストノードのエスケープ（> は &gt;）
  ["136 テキスト中の >", "x > y", "x &gt; y"],
  [
    "137 テキスト中の \" と ' 混在と >",
    'He said "it\'s > ok"',
    "He said &quot;it&#39;s &gt; ok&quot;",
  ],
  ["138 & を含む", "A & B", "A & B"],
  ["139 既に &lt; がある", "A &lt; B", "A &lt; B"],
  ["140 既に &amp; がある", "A &amp; B", "A &amp; B"],

  // 許可タグとテキスト混在
  [
    "141 strong と > の混在",
    "<strong>a</strong> > b",
    "<strong>a</strong> &gt; b",
  ],
  ["142 u と & の混在", "<u>A & B</u>", "<u>A & B</u>"],
  [
    "143 ul/li と > の混在",
    "<ul><li>a>b</li></ul>",
    "<ul><li>a&gt;b</li></ul>",
  ],
  [
    "144 li の中で \" と '",
    '<ul><li>He said "it\'s"</li></ul>',
    "<ul><li>He said &quot;it&#39;s&quot;</li></ul>",
  ],
  ["145 br を挟んだ >", "a<br> > b", "a<br> &gt; b"],

  // font の多様ケース
  ["146 font face のみ", '<font face="A">x</font>', '<font face="A">x</font>'],
  ["147 font size のみ", '<font size="4">x</font>', '<font size="4">x</font>'],
  [
    "148 font color のみ",
    '<font color="#abc">x</font>',
    '<font color="#abc">x</font>',
  ],
  [
    "149 font 許可外属性複合削除",
    '<font face="A" size="3" style="x" id="y">x</font>',
    '<font face="A" size="3">x</font>',
  ],
  [
    "150 font 内の a（http）",
    '<font face="A"><a href="http://a">x</a></font>',
    '<font face="A"><a href="http://a" target="_blank" rel="noopener noreferrer">x</a></font>',
  ],

  // br と混在するさまざまな表記
  ["151 br の前後スペース保持", "x <br> y", "x <br> y"],
  ["152 連続 br の正規化", "x<br/><br>y", "x<br /><br>y"],
  ["153 大文字 br 混在連続", "x<BR/><Br/><br>y", "x<BR /><Br /><br>y"],
  ["154 br 属性は消す", '<br id="a" class="b">', "<br>"],
  ["155 br 自己終了 + 属性消す", '<br data-x="1" />', "<br />"],

  // a 内のテキストや > の処理
  [
    "156 a 本文に > を含む",
    '<a href="/p">x>y</a>',
    '<a href="/p" target="_blank" rel="noopener noreferrer">x&gt;y</a>',
  ],
  [
    "157 a 本文に \" と '",
    '<a href="/p">"\'</a>',
    '<a href="/p" target="_blank" rel="noopener noreferrer">&quot;&#39;</a>',
  ],
  [
    "158 a href に < を含む",
    '<a href="http://a.com/?q=<t>">x</a>',
    '<a href="http://a.com/?q=<t>" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "159 a href に & を含む",
    '<a href="http://a.com/?a=1&b=2">x</a>',
    '<a href="http://a.com/?a=1&b=2" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "160 a href 空文字（許可）",
    '<a href="">x</a>',
    '<a href="" target="_blank" rel="noopener noreferrer">x</a>',
  ],

  // 角括弧系の強化
  ["161 テキストの < を &lt;", "a < b", "a &lt; b"],
  ["162 テキストの > を &gt;", "a > b", "a &gt; b"],
  [
    "163 タグ風文字列（ダブルクォート）",
    '< fake attr="v" >',
    "&lt; fake attr=&quot;v&quot; &gt;",
  ],
  [
    "164 タグ風文字列（シングルクォート）",
    "< fake attr='v' >",
    "&lt; fake attr=&#39;v&#39; &gt;",
  ],
  ["165 タグ風 + & 混在", "< fake & bad >", "&lt; fake & bad &gt;"],

  // 壊れタグ・不要属性の削除と > の扱い
  [
    "166 <a <b>> → <a>&gt;",
    "<a <b>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "167 <a data-x>> → data-x 削除で <a>&gt;",
    "<a data-x>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "168 <a onclick=evil>> → onclick 削除で <a>&gt;",
    "<a onclick=evil>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "169 <a href=http://ex>> → href は保持、余剰 > は &gt;",
    "<a href=http://ex>>",
    '<a href="http://ex" target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "170 <a href>> → href（値なし）保持、余剰 > は &gt;",
    "<a href>>",
    '<a href target="_blank" rel="noopener noreferrer">&gt;',
  ],

  // コメント/DOCTYPE/CDATA の追加バリエーション
  [
    '171 コメントに " を含む',
    '<!-- say "hi" -->',
    "&lt;!-- say &quot;hi&quot; --&gt;",
  ],
  ["172 コメントに ' を含む", "<!-- it's me -->", "&lt;!-- it&#39;s me --&gt;"],
  [
    "173 条件付きコメント複雑",
    "<!--[if lt IE 9]>x<!-- y --><![endif]-->",
    "&lt;!--[if lt IE 9]&gt;x&lt;!-- y --&gt;&lt;![endif]--&gt;",
  ],
  ["174 DOCTYPE 変種", "<!doctype html>", "&lt;!doctype html&gt;"],
  ["175 CDATA 変種", "<![cdata[ a ]]>", "&lt;![cdata[ a ]]&gt;"],

  // 許可タグの大小保持の確認
  [
    "176 Strong と U の大小保持",
    "<Strong><U>x</U></Strong>",
    "<Strong><U>x</U></Strong>",
  ],
  [
    "177 Font の大小保持（許可属性）",
    '<Font SIZE="3" COLOR="Red" FACE="A">x</Font>',
    '<Font SIZE="3" COLOR="Red" FACE="A">x</Font>',
  ],
  [
    "178 A の大小保持 + デフォルト付与",
    '<A HREF="/x">y</A>',
    '<A HREF="/x" target="_blank" rel="noopener noreferrer">y</A>',
  ],
  ["179 Br の大小保持 + 正規化", "a<BR/>b<Br/>c", "a<BR />b<Br />c"],
  ["180 Ul/Li の大小保持", "<Ul><Li>x</Li></Ul>", "<Ul><Li>x</Li></Ul>"],

  // 許可タグ内の不許可タグ（文字列化）
  [
    "181 strong 内の script 文字列化",
    "<strong><script>a()</script></strong>",
    "<strong>&lt;script&gt;a()&lt;/script&gt;</strong>",
  ],
  [
    "182 u 内の iframe 文字列化",
    "<u><iframe src='x'></iframe></u>",
    "<u>&lt;iframe src=&#39;x&#39;&gt;&lt;/iframe&gt;</u>",
  ],
  [
    "183 ul/li 内の svg 文字列化",
    "<ul><li><svg></svg></li></ul>",
    "<ul><li>&lt;svg&gt;&lt;/svg&gt;</li></ul>",
  ],
  [
    "184 a 内の script 文字列化",
    '<a href="/x"><script>1</script></a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">&lt;script&gt;1&lt;/script&gt;</a>',
  ],
  [
    "185 font 内の style 文字列化",
    "<font face='A'><style>x</style></font>",
    "<font face='A'>&lt;style&gt;x&lt;/style&gt;</font>",
  ],

  // 入れ子入れ替えや順序
  [
    "186 a 内に font（許可属性のみ）",
    '<a href="/x"><font face="A" style="x">t</font></a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer"><font face="A">t</font></a>',
  ],
  [
    "187 font 内に a（javascript 除去）",
    '<font face="A"><a href="javascript:x">t</a></font>',
    '<font face="A"><a target="_blank" rel="noopener noreferrer">t</a></font>',
  ],
  [
    "188 ul-li に a（http 許可）",
    '<ul><li><a href="http://x">t</a></li></ul>',
    '<ul><li><a href="http://x" target="_blank" rel="noopener noreferrer">t</a></li></ul>',
  ],
  [
    "189 ul-li に a（相対 許可）",
    '<ul><li><a href="/x">t</a></li></ul>',
    '<ul><li><a href="/x" target="_blank" rel="noopener noreferrer">t</a></li></ul>',
  ],
  [
    "190 ul-li に a（data 不許可）",
    '<ul><li><a href="data:x">t</a></li></ul>',
    '<ul><li><a target="_blank" rel="noopener noreferrer">t</a></li></ul>',
  ],

  // テキストの長めケース・境界
  ["191 長文 > 多数", "a > b > c > d", "a &gt; b &gt; c &gt; d"],
  [
    "192 引用付き長文",
    'He said: "a > b", I said: "ok"',
    "He said: &quot;a &gt; b&quot;, I said: &quot;ok&quot;",
  ],
  ["193 アンパサンド多用", "A & B & C & D", "A & B & C & D"],
  ["194 &lt; と > 混在", "x &lt; y > z", "x &lt; y &gt; z"],
  ["195 ' と \" と > 混在", `'> " >'`, "&#39;&gt; &quot; &gt;&#39;"],

  // a と壊れタグの複合
  [
    "196 <a <onclick=evil>>",
    "<a <onclick=evil>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "197 <a href=/x <b>>",
    "<a href=/x <b>>",
    '<a href="/x" target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "198 <a href> > テキスト > は &gt;",
    "<a href>text > end</a>",
    '<a href target="_blank" rel="noopener noreferrer">text &gt; end</a>',
  ],
  [
    "199 <a href=http://x> > テキスト > は &gt;",
    "<a href=http://x>t > e</a>",
    '<a href="http://x" target="_blank" rel="noopener noreferrer">t &gt; e</a>',
  ],
  [
    "200 <<a>> の仕様再確認（内側 a にデフォルト、外側 < と > はテキスト化）",
    "<<a>>",
    '&lt;<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "201 strong 内の ul/li ネスト",
    "<strong><ul><li>a</li></ul></strong>",
    "<strong><ul><li>a</li></ul></strong>",
  ],
  [
    "202 strong 内の br 自己終了",
    "<strong>x<br/>y</strong>",
    "<strong>x<br />y</strong>",
  ],
  [
    "203 strong 内の font 属性削除",
    '<strong><font size="3" face="A" onclick="e">x</font></strong>',
    '<strong><font size="3" face="A">x</font></strong>',
  ],
  [
    "204 strong 内の a（ftp 不許可）",
    '<strong><a href="ftp://x">z</a></strong>',
    '<strong><a target="_blank" rel="noopener noreferrer">z</a></strong>',
  ],
  ["205 u 内の br 正規化", "<u>x<br/>y</u>", "<u>x<br />y</u>"],
  [
    "206 u 内の a（mailto 不許可）",
    '<u><a href="mailto:a@b.com">m</a></u>',
    '<u><a target="_blank" rel="noopener noreferrer">m</a></u>',
  ],
  [
    "207 ul 内の li に font",
    '<ul><li><font face="A">f</font></li></ul>',
    '<ul><li><font face="A">f</font></li></ul>',
  ],
  [
    "208 li 内に a（https）",
    '<ul><li><a href="https://ok">h</a></li></ul>',
    '<ul><li><a href="https://ok" target="_blank" rel="noopener noreferrer">h</a></li></ul>',
  ],
  [
    "209 li 内に script（文字列化）",
    "<ul><li><script>1</script></li></ul>",
    "<ul><li>&lt;script&gt;1&lt;/script&gt;</li></ul>",
  ],
  [
    "210 ul/li ネスト3段",
    "<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>",
    "<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>",
  ],

  ["211 br 連続4個 混在", "a<br><br/><Br/><BR>z", "a<br><br /><Br /><BR>z"],
  ["212 br 属性削除テスト", '<br class="c" id="i">', "<br>"],
  ["213 br 自己終了属性削除", '<br class="c" />', "<br />"],
  ["214 br 大文字混在属性削除", '<BR class="c" />', "<BR />"],
  ["215 br タブ・改行混在自己終了", "a<Br\t/>b\n<BR />c", "a<Br />b\n<BR />c"],

  [
    "216 a href=http （無クォート属性）",
    "<a href=http://ok>x</a>",
    '<a href="http://ok" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "217 a href=https （無クォート属性）",
    "<a href=https://ok>x</a>",
    '<a href="https://ok" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "218 a href=相対 （無クォート属性）",
    "<a href=/rel>x</a>",
    '<a href="/rel" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "219 a href=空文字 （無クォート属性）",
    "<a href=>x</a>",
    '<a href="" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "220 a href 値なし属性（保持）",
    "<a href>k</a>",
    '<a href target="_blank" rel="noopener noreferrer">k</a>',
  ],

  [
    "221 a 内に strong",
    '<a href="http://e"><strong>t</strong></a>',
    '<a href="http://e" target="_blank" rel="noopener noreferrer"><strong>t</strong></a>',
  ],
  [
    "222 a 内に ul/li",
    '<a href="/x"><ul><li>t</li></ul></a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer"><ul><li>t</li></ul></a>',
  ],
  [
    "223 a 内に br",
    '<a href="/x">a<br/>b</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">a<br />b</a>',
  ],
  [
    "224 a 内に font",
    '<a href="/x"><font face="A">f</font></a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer"><font face="A">f</font></a>',
  ],
  [
    "225 a 内に script（文字列化）",
    '<a href="/x"><script>1</script></a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">&lt;script&gt;1&lt;/script&gt;</a>',
  ],

  [
    "226 font 内に strong",
    '<font face="A"><strong>s</strong></font>',
    '<font face="A"><strong>s</strong></font>',
  ],
  [
    "227 font 内に a",
    '<font face="A"><a href="http://e">x</a></font>',
    '<font face="A"><a href="http://e" target="_blank" rel="noopener noreferrer">x</a></font>',
  ],
  [
    "228 font 内に br",
    '<font face="A">a<br/>b</font>',
    '<font face="A">a<br />b</font>',
  ],
  [
    "229 font 内に ul/li",
    '<font face="A"><ul><li>x</li></ul></font>',
    '<font face="A"><ul><li>x</li></ul></font>',
  ],
  [
    "230 font 内に script（文字列化）",
    '<font face="A"><script>x</script></font>',
    '<font face="A">&lt;script&gt;x&lt;/script&gt;</font>',
  ],

  [
    "231 strong 内テキストに > と &",
    "<strong>x > y & z</strong>",
    "<strong>x &gt; y & z</strong>",
  ],
  ["232 u 内テキストに ' と \"", "<u>'\"</u>", "<u>&#39;&quot;</u>"],
  [
    "233 li 内テキストに < と >",
    "<ul><li>a < b > c</li></ul>",
    "<ul><li>a &lt; b &gt; c</li></ul>",
  ],
  [
    "234 font 内テキストに > と '",
    "<font face='A'>a>'</font>",
    "<font face='A'>a&gt;&#39;</font>",
  ],
  [
    "235 a 内テキストに < と >",
    "<a href='/'>a<b>c</a>",
    '<a href=\'/\' target="_blank" rel="noopener noreferrer">a&lt;b&gt;c</a>',
  ],

  ["236 コメント単体", "<!--c-->", "&lt;!--c--&gt;"],
  ["237 コメントに > を含む", "<!--a>b-->", "&lt;!--a&gt;b--&gt;"],
  ["238 コメントに ' を含む", "<!--it's-->", "&lt;!--it&#39;s--&gt;"],
  ["239 DOCTYPE 変形", "<!DoCtYpE html>", "&lt;!DoCtYpE html&gt;"],
  [
    "240 CDATA 長文",
    "<![CDATA[a>\"'&]]>",
    "&lt;![CDATA[a&gt;&quot;&#39;&]]&gt;",
  ],

  [
    "241 不許可タグ <table>",
    "<table><tr><td>x</td></tr></table>",
    "&lt;table&gt;&lt;tr&gt;&lt;td&gt;x&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;",
  ],
  [
    "242 不許可タグ <input>",
    '<input type="text">',
    "&lt;input type=&quot;text&quot;&gt;",
  ],
  [
    "243 不許可タグ <button>",
    "<button>x</button>",
    "&lt;button&gt;x&lt;/button&gt;",
  ],
  [
    "244 不許可タグ <form>",
    "<form action='/'>f</form>",
    "&lt;form action=&#39;/&#39;&gt;f&lt;/form&gt;",
  ],
  [
    "245 不許可タグ <textarea>",
    "<textarea>x</textarea>",
    "&lt;textarea&gt;x&lt;/textarea&gt;",
  ],

  [
    "246 不許可タグ <select>",
    "<select><option>1</option></select>",
    "&lt;select&gt;&lt;option&gt;1&lt;/option&gt;&lt;/select&gt;",
  ],
  [
    "247 不許可タグ <option>",
    "<option>1</option>",
    "&lt;option&gt;1&lt;/option&gt;",
  ],
  [
    "248 不許可タグ <object>",
    "<object data='x'></object>",
    "&lt;object data=&#39;x&#39;&gt;&lt;/object&gt;",
  ],
  [
    "249 不許可タグ <embed>",
    "<embed src='x' />",
    "&lt;embed src=&#39;x&#39; /&gt;",
  ],
  [
    "250 不許可タグ <applet>",
    "<applet>x</applet>",
    "&lt;applet&gt;x&lt;/applet&gt;",
  ],

  [
    "251 不許可タグ <meta>",
    '<meta charset="utf-8">',
    "&lt;meta charset=&quot;utf-8&quot;&gt;",
  ],
  ["252 不許可タグ <link>", '<link rel="x">', "&lt;link rel=&quot;x&quot;&gt;"],
  [
    "253 不許可タグ <base>",
    '<base href="/">',
    "&lt;base href=&quot;/&quot;&gt;",
  ],
  [
    "254 不許可タグ <title>",
    "<title>x</title>",
    "&lt;title&gt;x&lt;/title&gt;",
  ],
  ["255 不許可タグ <head>", "<head>x</head>", "&lt;head&gt;x&lt;/head&gt;"],

  [
    "256 a 内に > を含むテキスト",
    "<a href='/'>x > y</a>",
    '<a href=\'/\' target="_blank" rel="noopener noreferrer">x &gt; y</a>',
  ],
  [
    "257 font 内に > を含むテキスト",
    "<font face='A'>x > y</font>",
    "<font face='A'>x &gt; y</font>",
  ],
  [
    "258 ul/li 内に > を含むテキスト",
    "<ul><li>x > y</li></ul>",
    "<ul><li>x &gt; y</li></ul>",
  ],
  [
    "259 strong 内に > を含むテキスト",
    "<strong>x > y</strong>",
    "<strong>x &gt; y</strong>",
  ],
  ["260 u 内に > を含むテキスト", "<u>x > y</u>", "<u>x &gt; y</u>"],

  [
    "261 a href javascript:大文字混在",
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "262 a href data:大文字混在",
    '<a href="DATA:text/html,aaa">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "263 a href vbscript:大文字混在",
    '<a href="VbScRiPt:evil()">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "264 a href file:大文字混在",
    '<a href="FiLe:///etc/passwd">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "265 a href ftp:大文字混在",
    '<a href="FtP://host">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "266 a href 相対 './a:b'",
    '<a href="./a:b">x</a>',
    '<a href="./a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "267 a href 相対 '../a:b'",
    '<a href="../a:b">x</a>',
    '<a href="../a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "268 a href 相対 '?a:b'",
    '<a href="?a:b">x</a>',
    '<a href="?a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "269 a href 相対 '#a:b'",
    '<a href="#a:b">x</a>',
    '<a href="#a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "270 a href 未知スキーム（p:a:b）→ 削除",
    '<a href="p:a:b">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],

  ["271 コメント混在テキスト", "a<!--x-->b", "a&lt;!--x--&gt;b"],
  ["272 DOCTYPE 混在テキスト", "a<!DOCTYPE html>b", "a&lt;!DOCTYPE html&gt;b"],
  ["273 CDATA 混在テキスト", "a<![CDATA[x]]>b", "a&lt;![CDATA[x]]&gt;b"],
  ["274 山括弧混在テキスト", "a < b > c", "a &lt; b &gt; c"],
  ["275 クォート混在テキスト", "a \" b ' c", "a &quot; b &#39; c"],

  [
    "276 ul/li 複合の長文",
    "<ul><li>a > b</li><li>c & d</li><li>e ' f \" g</li></ul>",
    "<ul><li>a &gt; b</li><li>c & d</li><li>e &#39; f &quot; g</li></ul>",
  ],
  [
    "277 strong 複合の長文",
    "<strong>a > b & c ' d \" e</strong>",
    "<strong>a &gt; b & c &#39; d &quot; e</strong>",
  ],
  [
    "278 font 複合の長文",
    "<font face='A'>a > b & c ' d \" e</font>",
    "<font face='A'>a &gt; b & c &#39; d &quot; e</font>",
  ],
  [
    "279 a 複合の長文",
    '<a href="/x">a > b & c " d \' e</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">a &gt; b & c &quot; d &#39; e</a>',
  ],
  [
    "280 u 複合の長文",
    "<u>a > b & c ' d \" e</u>",
    "<u>a &gt; b & c &#39; d &quot; e</u>",
  ],

  [
    "281 strong 内の壊れタグ <div>",
    "<strong><div>x</div></strong>",
    "<strong>&lt;div&gt;x&lt;/div&gt;</strong>",
  ],
  [
    "282 u 内の壊れタグ <span>",
    "<u><span>x</span></u>",
    "<u>&lt;span&gt;x&lt;/span&gt;</u>",
  ],
  [
    "283 li 内の壊れタグ <script>",
    "<ul><li><script>1</script></li></ul>",
    "<ul><li>&lt;script&gt;1&lt;/script&gt;</li></ul>",
  ],
  [
    "284 font 内の壊れタグ <style>",
    "<font face='A'><style>x</style></font>",
    "<font face='A'>&lt;style&gt;x&lt;/style&gt;</font>",
  ],
  [
    "285 a 内の壊れタグ <iframe>",
    '<a href="/x"><iframe>x</iframe></a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">&lt;iframe&gt;x&lt;/iframe&gt;</a>',
  ],

  [
    "286 br 連続10個混在",
    "a<br><br/><br><br/><br><br/><br><br/><br><br/>z",
    "a<br><br /><br><br /><br><br /><br><br /><br><br />z",
  ],
  ["287 br 前後テキストと > 混在", "a > <br> b", "a &gt; <br> b"],
  ["288 br 内部属性削除確認", '<br id="x" style="y" />', "<br />"],
  ["289 br 大文字混在内部属性削除", '<BR id="x" />', "<BR />"],
  ["290 br 改行挟み", "a\n<br/>b", "a\n<br />b"],

  [
    "291 a href に制御文字混在",
    '<a href="jav\u0000ascript:x">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "292 a href に空白混在",
    '<a href="ja va script:x">x</a>',
    '<a href="ja va script:x" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "293 a href にタブ混在",
    '<a href="ja\tva\tscript:x">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "294 a href に改行混在",
    '<a href="ja\nva\nscript:x">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "295 a href に大文字小文字混在",
    '<a href="jAvAsCrIpT:x">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],

  // ▼ 201..300 のうち 296..300 を差し替え
  [
    "296 a href に data:image/svg+xml",
    '<a href="data:image/svg+xml,<svg>">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "297 a href に file://",
    '<a href="file:///c:/win.ini">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "298 a href に vbscript:",
    '<a href="vbscript:evil()">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "299 a href に mailto:",
    '<a href="mailto:test@example.com">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "300 a href に intent:（未知スキーム）",
    '<a href="intent://scan/#Intent;scheme=zxing;end">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "301 a href に chrome://（未知スキーム）",
    '<a href="chrome://settings">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "302 a href に about:（未知スキーム）",
    '<a href="about:blank">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "303 a href に market:（未知スキーム）",
    '<a href="market://details?id=app">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "304 a href に ws://（未知スキーム）",
    '<a href="ws://ex">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "305 a href に blob:（未知スキーム）",
    '<a href="blob:https://ex/id">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "306 a href 相対（protocol-relative //ex）",
    '<a href="//ex.com/x">x</a>',
    '<a href="//ex.com/x" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "307 a href 相対（?のみ）",
    '<a href="?">x</a>',
    '<a href="?" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "308 a href 相対（#のみ）",
    '<a href="#">x</a>',
    '<a href="#" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "309 a href 相対（空文字）",
    '<a href="">x</a>',
    '<a href="" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "310 a href 省略（属性なし）",
    "<a>x</a>",
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "311 a 無クォート href=//ex",
    "<a href=//ex>x</a>",
    '<a href="//ex" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "312 a 無クォート href=./x",
    "<a href=./x>x</a>",
    '<a href="./x" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "313 a 無クォート href=../x",
    "<a href=../x>x</a>",
    '<a href="../x" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "314 a 無クォート href=?q=1",
    "<a href=?q=1>x</a>",
    '<a href="?q=1" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "315 a 無クォート href=#a",
    "<a href=#a>x</a>",
    '<a href="#a" target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "316 a href に改行（相対）",
    '<a href="./a\nb">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "317 a href にタブ（相対）",
    '<a href="./a\tb">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "318 a href にスペース（相対）",
    '<a href="./a b">x</a>',
    '<a href="./a b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "319 a href に %20（相対）",
    '<a href="./a%20b">x</a>',
    '<a href="./a%20b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "320 a href に日本語（相対）",
    '<a href="/検索">x</a>',
    '<a href="/検索" target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "321 a href に日本語（http）",
    '<a href="http://ex.com/日本語">x</a>',
    '<a href="http://ex.com/日本語" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "322 a href に絵文字",
    '<a href="/😀">x</a>',
    '<a href="/😀" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "323 a href に & と = と ;",
    '<a href="/p?a=1&b=2;c=3">x</a>',
    '<a href="/p?a=1&b=2;c=3" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "324 a href に < と >",
    '<a href="/p?<q>=a>b">x</a>',
    '<a href="/p?<q>=a>b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "325 a href に #? 混在",
    '<a href="/p#top?x=1">x</a>',
    '<a href="/p#top?x=1" target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "326 a 既存 rel のみ",
    '<a href="/x" rel="nofollow">x</a>',
    '<a href="/x" rel="nofollow" target="_blank">x</a>',
  ],
  [
    "327 a 既存 target のみ",
    '<a href="/x" target="_self">x</a>',
    '<a href="/x" target="_self" rel="noopener noreferrer">x</a>',
  ],
  [
    "328 a 既存 rel/target あり",
    '<a href="/x" rel="ext" target="_top">x</a>',
    '<a href="/x" rel="ext" target="_top">x</a>',
  ],
  [
    "329 a 不許可属性混在（削除）",
    '<a href="/x" style="x" onclick="y" data-a>t</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "330 a href 値なし属性（保持）",
    "<a href>t</a>",
    '<a href target="_blank" rel="noopener noreferrer">t</a>',
  ],

  [
    "331 strong/u 連結",
    "<strong>a</strong><u>b</u>",
    "<strong>a</strong><u>b</u>",
  ],
  [
    "332 strong + br + u",
    "<strong>a</strong><br><u>b</u>",
    "<strong>a</strong><br><u>b</u>",
  ],
  [
    "333 strong + br/ 正規化",
    "<strong>a</strong><br/>b",
    "<strong>a</strong><br />b",
  ],
  ["334 ul/li + br", "<ul><li>a</li></ul><br/>", "<ul><li>a</li></ul><br />"],
  [
    "335 font + br",
    '<font face="A">x</font><br/>y',
    '<font face="A">x</font><br />y',
  ],

  [
    "336 strong 属性削除再確認",
    '<strong id="x" data-a>t</strong>',
    "<strong>t</strong>",
  ],
  ["337 u 属性削除再確認", '<u style="x" onclick="y">t</u>', "<u>t</u>"],
  ["338 ul 属性削除再確認", '<ul class="c">t</ul>', "<ul>t</ul>"],
  ["339 li 属性削除再確認", '<li class="c">t</li>', "<li>t</li>"],
  [
    "340 font 不許可属性再確認",
    '<font face="A" size="3" class="c" id="i">t</font>',
    '<font face="A" size="3">t</font>',
  ],

  [
    "341 不許可 <table> 入れ子",
    "<strong><table><tr><td>x</td></tr></table></strong>",
    "<strong>&lt;table&gt;&lt;tr&gt;&lt;td&gt;x&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</strong>",
  ],
  [
    "342 不許可 <iframe> 入れ子",
    "<u><iframe src='x'></iframe></u>",
    "<u>&lt;iframe src=&#39;x&#39;&gt;&lt;/iframe&gt;</u>",
  ],
  [
    "343 不許可 <script> 入れ子",
    "<ul><li><script>1</script></li></ul>",
    "<ul><li>&lt;script&gt;1&lt;/script&gt;</li></ul>",
  ],
  [
    "344 不許可 <style> 入れ子",
    "<font face='A'><style>x</style></font>",
    "<font face='A'>&lt;style&gt;x&lt;/style&gt;</font>",
  ],
  [
    "345 不許可 <object> 入れ子",
    "<strong><object>y</object></strong>",
    "<strong>&lt;object&gt;y&lt;/object&gt;</strong>",
  ],

  ["346 半端な > 多発", "a > b >> c", "a &gt; b &gt;&gt; c"],
  ["347 半端な < 多発", "a << b < c", "a &lt;&lt; b &lt; c"],
  ["348 半端な山括弧と &", "a <&> b", "a &lt;&&gt; b"],
  [
    "349 タグ風 + クォート混在",
    "< fake a=\"1\" b='2'>",
    "&lt; fake a=&quot;1&quot; b=&#39;2&#39;&gt;",
  ],
  ["350 タグ風 + 改行混在", "< fake\na='1' >", "&lt; fake\na=&#39;1&#39; &gt;"],

  ["351 コメントの前後テキスト", "a<!--x-->b", "a&lt;!--x--&gt;b"],
  [
    "352 DOCTYPE の前後テキスト",
    "a<!DOCTYPE html>b",
    "a&lt;!DOCTYPE html&gt;b",
  ],
  ["353 CDATA の前後テキスト", "a<![CDATA[x]]>b", "a&lt;![CDATA[x]]&gt;b"],
  [
    "354 コメントの入れ子風2",
    "<!-- a <!-- b <!-- c --> d -->",
    "&lt;!-- a &lt;!-- b &lt;!-- c --&gt; d --&gt;",
  ],
  ["355 コメントにクォート混在", "<!-- \" '>", "&lt;!-- &quot; &#39;&gt;"],

  [
    "356 a + 壊れ属性 <a <b>>",
    "<a <b>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "357 a + 壊れ属性 <a data-x>>",
    "<a data-x>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "358 a + 壊れ属性 <a onclick=evil>>",
    "<a onclick=evil>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "359 a + 壊れ属性 <a href=/x <y>>",
    "<a href=/x <y>>",
    '<a href="/x" target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "360 a + 壊れ属性 <<a>>（内側 a にデフォルト付与）",
    "<<a>>",
    '&lt;<a target="_blank" rel="noopener noreferrer">&gt;',
  ],

  [
    "361 テキスト中のクォート",
    "He said \"Hi\", I said 'Yo'",
    "He said &quot;Hi&quot;, I said &#39;Yo&#39;",
  ],
  [
    "362 テキスト + strong + >",
    "x <strong>y</strong> > z",
    "x <strong>y</strong> &gt; z",
  ],
  ["363 テキスト + u + <", "x <u>y</u> < z", "x <u>y</u> &lt; z"],
  [
    "364 テキスト + ul/li + both",
    "<ul><li>a < b > c</li></ul>",
    "<ul><li>a &lt; b &gt; c</li></ul>",
  ],
  [
    "365 テキスト + font + mix",
    "<font face='A'>a < b > c & d \" e ' f</font>",
    "<font face='A'>a &lt; b &gt; c & d &quot; e &#39; f</font>",
  ],

  [
    "366 a text にクォート混在",
    '<a href="/x">"\'</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">&quot;&#39;</a>',
  ],
  [
    "367 a text に山括弧混在",
    '<a href="/x"><y></a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">&lt;y&gt;</a>',
  ],
  [
    "368 a text に > 多発",
    '<a href="/x">a>b>c</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">a&gt;b&gt;c</a>',
  ],
  [
    "369 a text に < 多発",
    '<a href="/x">a<b<c</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">a&lt;b&lt;c&lt;/a&gt;',
  ],
  [
    "370 a text に & 多発",
    '<a href="/x">A & B & C</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">A & B & C</a>',
  ],

  [
    "371 font 属性の大小混在",
    '<Font SIZE="5" color="#0f0" FACE="ＭＳ ゴシック">x</Font>',
    '<Font SIZE="5" color="#0f0" FACE="ＭＳ ゴシック">x</Font>',
  ],
  [
    "372 font + 許可外属性は削除",
    '<font face="A" id="x" data-a size="3">x</font>',
    '<font face="A" size="3">x</font>',
  ],
  [
    "373 font + 許可外属性多数",
    '<font class="c" style="s" data-a color="red">x</font>',
    '<font color="red">x</font>',
  ],
  [
    "374 font + br 正規化",
    '<font face="A">a<br/>b<br>c</font>',
    '<font face="A">a<br />b<br>c</font>',
  ],
  [
    "375 font + a javascript 除去",
    '<font face="A"><a href="javascript:x">t</a></font>',
    '<font face="A"><a target="_blank" rel="noopener noreferrer">t</a></font>',
  ],

  [
    "376 ul/li + 不許可 table 文字列化",
    "<ul><li><table>x</table></li></ul>",
    "<ul><li>&lt;table&gt;x&lt;/table&gt;</li></ul>",
  ],
  [
    "377 ul/li + 不許可 iframe 文字列化",
    "<ul><li><iframe>x</iframe></li></ul>",
    "<ul><li>&lt;iframe&gt;x&lt;/iframe&gt;</li></ul>",
  ],
  [
    "378 strong + 不許可 video 文字列化",
    "<strong><video>x</video></strong>",
    "<strong>&lt;video&gt;x&lt;/video&gt;</strong>",
  ],
  [
    "379 u + 不許可 audio 文字列化",
    "<u><audio>x</audio></u>",
    "<u>&lt;audio&gt;x&lt;/audio&gt;</u>",
  ],
  [
    "380 font + 不許可 object 文字列化",
    "<font face='A'><object>x</object></font>",
    "<font face='A'>&lt;object&gt;x&lt;/object&gt;</font>",
  ],

  ["381 コメントと br 混在", "a<!--x--><br/>b", "a&lt;!--x--&gt;<br />b"],
  [
    "382 DOCTYPE と br 混在",
    "a<!DOCTYPE html><br>b",
    "a&lt;!DOCTYPE html&gt;<br>b",
  ],
  [
    "383 CDATA と br 混在",
    "a<![CDATA[x]]><br/>b",
    "a&lt;![CDATA[x]]&gt;<br />b",
  ],
  ["384 タグ風と br 混在", "< bad ><br/>", "&lt; bad &gt;<br />"],
  ["385 山括弧と br 混在", "a < <br> > b", "a &lt; <br> &gt; b"],

  [
    "386 <a <b>> パターン再確認",
    "<a <b>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "387 <a data-x>> パターン再確認",
    "<a data-x>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "388 <a onclick=evil>> パターン再確認",
    "<a onclick=evil>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "389 <a href=/x <y>> パターン再確認",
    "<a href=/x <y>>",
    '<a href="/x" target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "390 <<a>> パターン再確認",
    "<<a>>",
    '&lt;<a target="_blank" rel="noopener noreferrer">&gt;',
  ],

  [
    "391 a href 空文字（再確認）",
    '<a href="">x</a>',
    '<a href="" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "392 a href 値なし属性（再確認）",
    "<a href>t</a>",
    '<a href target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "393 a href 相対（再確認）",
    '<a href="/x">t</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "394 a href http（再確認）",
    '<a href="http://x">t</a>',
    '<a href="http://x" target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "395 a href https（再確認）",
    '<a href="https://x">t</a>',
    '<a href="https://x" target="_blank" rel="noopener noreferrer">t</a>',
  ],

  [
    "396 a href 危険（javascript 再確認）",
    '<a href="javascript:x">t</a>',
    '<a target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "397 a href 危険（data 再確認）",
    '<a href="data:x">t</a>',
    '<a target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "398 a href 危険（file 再確認）",
    '<a href="file:///x">t</a>',
    '<a target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "399 a href 危険（vbscript 再確認）",
    '<a href="vbscript:x">t</a>',
    '<a target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "400 a href 未知（custom: 再確認）",
    '<a href="custom:abc">t</a>',
    '<a target="_blank" rel="noopener noreferrer">t</a>',
  ],
  [
    "401 strong + a 相対 + > 混在",
    '<strong><a href="/x">a > b</a></strong>',
    '<strong><a href="/x" target="_blank" rel="noopener noreferrer">a &gt; b</a></strong>',
  ],
  [
    "402 u + a http + クォート混在",
    '<u><a href="http://e">"\'</a></u>',
    '<u><a href="http://e" target="_blank" rel="noopener noreferrer">&quot;&#39;</a></u>',
  ],
  [
    "403 ul/li + a https",
    '<ul><li><a href="https://e">t</a></li></ul>',
    '<ul><li><a href="https://e" target="_blank" rel="noopener noreferrer">t</a></li></ul>',
  ],
  [
    "404 ul/li + a 相対 + < と >",
    '<ul><li><a href="/p">a<b>c>d</a></li></ul>',
    '<ul><li><a href="/p" target="_blank" rel="noopener noreferrer">a&lt;b&gt;c&gt;d</a></li></ul>',
  ],
  [
    "405 font + a 空href",
    '<font face="G"><a href="">x</a></font>',
    '<font face="G"><a href="" target="_blank" rel="noopener noreferrer">x</a></font>',
  ],
  [
    "406 font + a href 値なし属性",
    '<font face="G"><a href>y</a></font>',
    '<font face="G"><a href target="_blank" rel="noopener noreferrer">y</a></font>',
  ],
  [
    "407 font + a javascript 除去",
    '<font face="G"><a href="javascript:x">z</a></font>',
    '<font face="G"><a target="_blank" rel="noopener noreferrer">z</a></font>',
  ],
  [
    "408 strong + font 許可属性のみ",
    '<strong><font size="4" color="#333" face="A" id="i">x</font></strong>',
    '<strong><font size="4" color="#333" face="A">x</font></strong>',
  ],
  [
    "409 u + font + br 正規化",
    '<u><font face="A">x<br/>y</font></u>',
    '<u><font face="A">x<br />y</font></u>',
  ],
  [
    "410 ul/li + font + a https",
    '<ul><li><font face="A"><a href="https://e">t</a></font></li></ul>',
    '<ul><li><font face="A"><a href="https://e" target="_blank" rel="noopener noreferrer">t</a></font></li></ul>',
  ],

  [
    "411 a 無クォート + ?query",
    "<a href=/p?q=1&x=2>k</a>",
    '<a href="/p?q=1&x=2" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "412 a 無クォート + #hash",
    "<a href=/p#top>k</a>",
    '<a href="/p#top" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "413 a 無クォート + ./path",
    "<a href=./p>k</a>",
    '<a href="./p" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "414 a 無クォート + ../path",
    "<a href=../p>k</a>",
    '<a href="../p" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "415 a 無クォート + //host",
    "<a href=//ex.com/x>k</a>",
    '<a href="//ex.com/x" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    '416 a 無クォート + 値中に " → \\"',
    '<a href=/p?q="v">k</a>',
    '<a href="/p?q=\\"v\\"" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "417 a 無クォート + 値中スペース",
    "<a href=/p?q= a >k</a>",
    '<a href="/p?q=" target="_blank" rel="noopener noreferrer">k</a>',
  ],
  [
    "418 a 無クォート + 末尾 > は &gt;",
    "<a href=/p>x>y</a>",
    '<a href="/p" target="_blank" rel="noopener noreferrer">x&gt;y</a>',
  ],
  [
    "419 a シングルクォート属性は維持",
    "<a href='/p?a=\"v\"'>x</a>",
    '<a href=\'/p?a="v"\' target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "420 a ダブルクォート属性で内部 ' はそのまま",
    "<a href=\"/p?a='v'\">x</a>",
    '<a href="/p?a=\'v\'" target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "421 壊れタグ <a <onclick>>",
    "<a <onclick>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "422 壊れタグ <a data-x>>",
    "<a data-x>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "423 壊れタグ <a href=/x <y>>",
    "<a href=/x <y>>",
    '<a href="/x" target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "424 壊れタグ <<a>>（内側 a にデフォルト）",
    "<<a>>",
    '&lt;<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "425 壊れタグ <a href>>（値なし保持）",
    "<a href>>",
    '<a href target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "426 壊れタグ <a href=>（空文字許可）",
    "<a href=>x</a>",
    '<a href="" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "427 壊れタグ <a href=http://x>>",
    "<a href=http://x>>",
    '<a href="http://x" target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "428 壊れタグ <a <b c>>（複数不要属性）",
    "<a <b c>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "429 壊れタグ <a \n<b>>（改行混在）",
    "<a \n<b>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],
  [
    "430 壊れタグ <a\t<b>>（タブ混在）",
    "<a\t<b>>",
    '<a target="_blank" rel="noopener noreferrer">&gt;',
  ],

  [
    '431 不許可タグ <script> を文字列化 + "',
    '<script>alert("x")</script>',
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
  ],
  [
    "432 不許可タグ <style> を文字列化 + '",
    "<style>p{content:'x'}</style>",
    "&lt;style&gt;p{content:&#39;x&#39;}&lt;/style&gt;",
  ],
  [
    "433 不許可タグ <iframe> 文字列化 + > → &gt;",
    "<iframe>a>b</iframe>",
    "&lt;iframe&gt;a&gt;b&lt;/iframe&gt;",
  ],
  [
    "434 不許可タグ <object> 文字列化",
    "<object data='x'></object>",
    "&lt;object data=&#39;x&#39;&gt;&lt;/object&gt;",
  ],
  [
    "435 不許可タグ <embed> 文字列化",
    '<embed src="x" />',
    "&lt;embed src=&quot;x&quot; /&gt;",
  ],

  [
    "436 不許可タグ <table> 文字列化",
    "<table><tr><td>x</td></tr></table>",
    "&lt;table&gt;&lt;tr&gt;&lt;td&gt;x&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;",
  ],
  [
    "437 不許可タグ <input> 文字列化",
    '<input type="text">',
    "&lt;input type=&quot;text&quot;&gt;",
  ],
  [
    "438 不許可タグ <select> 文字列化",
    "<select><option>1</option></select>",
    "&lt;select&gt;&lt;option&gt;1&lt;/option&gt;&lt;/select&gt;",
  ],
  [
    "439 不許可タグ <textarea> 文字列化",
    "<textarea>x</textarea>",
    "&lt;textarea&gt;x&lt;/textarea&gt;",
  ],
  [
    "440 不許可タグ <form> 文字列化",
    "<form action='/'>x</form>",
    "&lt;form action=&#39;/&#39;&gt;x&lt;/form&gt;",
  ],

  ["441 コメント 文字列化 基本", "<!--x-->", "&lt;!--x--&gt;"],
  ["442 コメント 内に >", "<!-- a > b -->", "&lt;!-- a &gt; b --&gt;"],
  [
    "443 コメント 内に \" と '",
    "<!-- \" and ' -->",
    "&lt;!-- &quot; and &#39; --&gt;",
  ],
  ["444 DOCTYPE を文字列化", "<!DOCTYPE html>", "&lt;!DOCTYPE html&gt;"],
  ["445 CDATA を文字列化", "<![CDATA[x]]>", "&lt;![CDATA[x]]&gt;"],

  ["446 テキスト > エスケープ", "x > y", "x &gt; y"],
  ["447 テキスト < エスケープ", "x < y", "x &lt; y"],
  ['448 テキスト " エスケープ', 'x " y', "x &quot; y"],
  ["449 テキスト ' エスケープ", "x ' y", "x &#39; y"],
  ["450 テキスト & は保持", "x & y", "x & y"],

  ["451 許可タグの大小保持1", "<Strong>X</Strong>", "<Strong>X</Strong>"],
  ["452 許可タグの大小保持2", "<U>Y</U>", "<U>Y</U>"],
  ["453 許可タグの大小保持3（Br 正規化）", "a<BR/>b", "a<BR />b"],
  [
    "454 許可タグの大小保持4（Ul/Li）",
    "<Ul><Li>t</Li></Ul>",
    "<Ul><Li>t</Li></Ul>",
  ],
  [
    "455 font 大小保持 + 許可属性",
    '<Font SIZE="3" FACE="A" COLOR="red">t</Font>',
    '<Font SIZE="3" FACE="A" COLOR="red">t</Font>',
  ],

  [
    "456 strong 属性削除",
    '<strong id="i" class="c">t</strong>',
    "<strong>t</strong>",
  ],
  ["457 u 属性削除", '<u style="x" onclick="y">t</u>', "<u>t</u>"],
  ["458 ul 属性削除", "<ul data-x>t</ul>", "<ul>t</ul>"],
  ["459 li 属性削除", '<li lang="ja">t</li>', "<li>t</li>"],
  [
    "460 font 許可外属性削除",
    '<font face="A" size="3" id="i" class="c">t</font>',
    '<font face="A" size="3">t</font>',
  ],

  ["461 br 連続 混在", "a<br/><br><Br/><BR>z", "a<br /><br><Br /><BR>z"],
  ["462 br 属性削除", '<br class="x">', "<br>"],
  ["463 br 自己終了 + 属性削除", '<br data-a="1" />', "<br />"],
  ["464 br 改行混在", "a\n<br/>b", "a\n<br />b"],
  ["465 br タブ混在", "a\t<Br/>\tb", "a\t<Br />\tb"],

  [
    "466 a text の < > & ' \" 混在",
    '<a href="/x">a<b>c & d " e \' f</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">a&lt;b&gt;c & d &quot; e &#39; f</a>',
  ],
  [
    "467 strong text の < > & ' \" 混在",
    "<strong>a<b>c & d \" e ' f</strong>",
    "<strong>a&lt;b&gt;c & d &quot; e &#39; f</strong>",
  ],
  [
    "468 u text の < > & ' \" 混在",
    "<u>a<b>c & d \" e ' f</u>",
    "<u>a&lt;b&gt;c & d &quot; e &#39; f</u>",
  ],
  [
    "469 font text の < > & ' \" 混在",
    "<font face='A'>a<b>c & d \" e ' f</font>",
    "<font face='A'>a&lt;b&gt;c & d &quot; e &#39; f</font>",
  ],
  [
    "470 ul/li text の < > & ' \" 混在",
    "<ul><li>a<b>c & d \" e ' f</li></ul>",
    "<ul><li>a&lt;b&gt;c & d &quot; e &#39; f</li></ul>",
  ],

  [
    "471 a href 文字参照回避（jav&#x61;script）",
    '<a href="jav&#x61;script:1">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "472 a href 文字参照回避（java&#115;cript）",
    '<a href="java&#115;cript:1">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "473 a href 分断（ja va script）",
    '<a href="ja va script:1">x</a>',
    '<a href="ja va script:1" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "474 a href 分断（ja\\nva script）",
    '<a href="ja\nva script:1">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "475 a href 分断（jav\\u0000ascript）",
    '<a href="jav\u0000ascript:1">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "476 a href 未知スキーム（p:）は削除",
    '<a href="p:a:b">x</a>',
    '<a target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "477 a href 相対 '?a:b'（相対扱い）",
    '<a href="?a:b">x</a>',
    '<a href="?a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "478 a href 相対 '#a:b'（相対扱い）",
    '<a href="#a:b">x</a>',
    '<a href="#a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "479 a href 相対 './a:b'（相対扱い）",
    '<a href="./a:b">x</a>',
    '<a href="./a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],
  [
    "480 a href 相対 '../a:b'（相対扱い）",
    '<a href="../a:b">x</a>',
    '<a href="../a:b" target="_blank" rel="noopener noreferrer">x</a>',
  ],

  [
    "481 <<a>> パターン + 中身テキスト",
    "<<a>>text",
    '&lt;<a target="_blank" rel="noopener noreferrer">&gt;text',
  ],
  [
    "482 <a <b>> パターン + 中身テキスト",
    "<a <b>>text",
    '<a target="_blank" rel="noopener noreferrer">&gt;text',
  ],
  [
    "483 <a data-x>> + テキスト",
    "<a data-x>>ok</a>",
    '<a target="_blank" rel="noopener noreferrer">&gt;ok</a>',
  ],
  [
    "484 <a href=/x>> + テキスト",
    "<a href=/x>>ok</a>",
    '<a href="/x" target="_blank" rel="noopener noreferrer">&gt;ok</a>',
  ],
  [
    "485 <a href> > テキスト",
    "<a href>ok > end</a>",
    '<a href target="_blank" rel="noopener noreferrer">ok &gt; end</a>',
  ],

  [
    "486 font の中で不許可タグ文字列化",
    "<font face='A'><div>x</div></font>",
    "<font face='A'>&lt;div&gt;x&lt;/div&gt;</font>",
  ],
  [
    "487 strong の中で不許可タグ文字列化",
    "<strong><span>x</span></strong>",
    "<strong>&lt;span&gt;x&lt;/span&gt;</strong>",
  ],
  [
    "488 u の中で不許可タグ文字列化",
    "<u><iframe>x</iframe></u>",
    "<u>&lt;iframe&gt;x&lt;/iframe&gt;</u>",
  ],
  [
    "489 ul/li の中で不許可タグ文字列化",
    "<ul><li><object>x</object></li></ul>",
    "<ul><li>&lt;object&gt;x&lt;/object&gt;</li></ul>",
  ],
  [
    "490 a の中で不許可タグ文字列化",
    '<a href="/x"><video>v</video></a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">&lt;video&gt;v&lt;/video&gt;</a>',
  ],

  [
    "491 文章長め1",
    "<strong>Hello</strong> & world > all",
    "<strong>Hello</strong> & world &gt; all",
  ],
  ["492 文章長め2", '<u>He said "ok"</u>', "<u>He said &quot;ok&quot;</u>"],
  [
    "493 文章長め3",
    "<ul><li>1</li><li>2 ' 3</li></ul>",
    "<ul><li>1</li><li>2 &#39; 3</li></ul>",
  ],
  [
    "494 文章長め4",
    "<font face='A'>a & b < c > d</font>",
    "<font face='A'>a & b &lt; c &gt; d</font>",
  ],
  [
    "495 文章長め5",
    '<a href="/x">"a" & \'b\' > c</a>',
    '<a href="/x" target="_blank" rel="noopener noreferrer">&quot;a&quot; & &#39;b&#39; &gt; c</a>',
  ],

  [
    "496 a rel/target 既存は変更なし",
    '<a href="/x" rel="ext" target="_top">t</a>',
    '<a href="/x" rel="ext" target="_top">t</a>',
  ],
  [
    "497 a rel 既存のみ（target 付与）",
    '<a href="/x" rel="nofollow">t</a>',
    '<a href="/x" rel="nofollow" target="_blank">t</a>',
  ],
  [
    "498 a target 既存のみ（rel 付与）",
    '<a href="/x" target="_self">t</a>',
    '<a href="/x" target="_self" rel="noopener noreferrer">t</a>',
  ],
  [
    "499 a 属性順序保持",
    '<a rel="n" href="/x" target="_self">t</a>',
    '<a rel="n" href="/x" target="_self">t</a>',
  ],
  [
    "500 a 属性大小保持",
    '<A HREF="/x">t</A>',
    '<A HREF="/x" target="_blank" rel="noopener noreferrer">t</A>',
  ],
];

describe("sanitizeHtml", () => {
  it.each(testCases)("%s\ninput", (_, input, expected) => {
    const sanitized = sanitizeHtml(input, option);
    expect(sanitized).toBe(expected);
  });
});
