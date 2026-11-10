# 墨 · pneuma-shuimo

一张空白的纸，一个墨圆。圆是助理，它是活的；主人说一句话，它从圆里写出一样能用的东西。

这是一个旁路实验：不依赖 super-assistant 的任何代码，从零实现，验证"Agent 用笔墨为主人生出内容"能不能收敛成一套可交付的东西：**播放器 + 脚本 + skill + 质检 + 示例**。结论见 [EXPERIMENT.md](EXPERIMENT.md)。

## 两种内容，一支笔

| | 灵：活的头像 | 生：长出来的东西 |
|---|---|---|
| 是什么 | 圆自己的表演：闲时慢慢写一幅，指针来了演两三秒，被撞见会回应 | 从圆里拉出一笔，写出一样能用的小东西：记数、打卡、清单 |
| Agent 写的 | 小品脚本 `pieces/*.json` | 脚本 `examples/*.json` |
| 播放器 | `summon()` · `src/spirit.js` | `mount()` · `src/player.js` |
| 格式与校验 | `validatePiece()` · `src/piece.js` | `validate()` · `src/script.js` |
| Skill | [`skill/PIECE.md`](skill/PIECE.md) | [`skill/SKILL.md`](skill/SKILL.md) |
| 质检 | `tools/film.mjs`：校验 + 每写完一笔拍一格 | `tools/check.mjs` 校验 · `tools/shoot.mjs` 四种截图 |
| 示例 | 鱼跃、雀、芽、睡猫、哈欠 | 饮水、晨课、待读、行李、带伞 |

底下是同一套笔墨：`src/brush.js`（笔：一根根笔毛，干湿浓淡）、`src/paper.js`（纸：每笔一层，只写和干）。

## 几条定下来的规矩

- **只有写和干。** 纸上没有任何东西移动、旋转、拉伸或缩放。"动"是这一笔干去、下一笔写在别处。
- **从圆来，回圆去。** 小品结束时所有墨都干去，只剩圆（测试里有这条不变量）；长出来的东西点一下圆就干回去。
- **脚本是纯数据。** 没有代码、颜色、字号。上纸之前必过校验，被拒的理由是一句句"哪里错、怎么改"，可以原样退给 Agent。
- **分工。** Agent 决定内容（叫什么、有哪几行、画什么、怎么演）；播放器决定摆放和笔法。所以无论谁写，出来的都是同一只手。
- **墨管生灭，纸和字管内容。** 标题和行是真的文字，输入框是真的输入框；笔毛只画圆、那一笔、圈、点、"正"字和小画。
- **质检是给模型的眼睛准备的。** 校验器管得住格式、边界、时长和几条能量化的法度；像不像、好不好玩，靠模型自己看截图和连续画面。

## 看

```sh
node tools/serve.mjs          # http://127.0.0.1:4173/demo/
```

打开就是一屏的总览：

- **一 · 它此刻的样子**：一个大的头像在六种状态间不停轮转：静（无事）、看（指针来了，点睛，演一小段）、思（圆一遍遍重写）、作（笔在圆里一段段地走，做完合口）、闲（慢慢写一幅）、空（墨淡成一道痕再写回来）。点状态可以跳过去；把指针放到它身上，它就交给你。
- **灵**：每一幅小品一个小头像，各自一遍遍地演；指针放上去它们会回应。标着"模型写的"是干净的 Opus 5.5 只凭 skill 写的。
- **生**：三个位置轮流写出每一样长出来的东西，用过的样子，再收回圆里。
- **一笔**：那个圆的全部数据，和三条规矩。

另外两页：`/demo/avatar.html`（单个头像，逐幅点播）、`/demo/sheets.html`（全部长出来的东西，可以真的用）。

```sh
node tools/check.mjs examples/*.json                    # 校验，打印时间表
node tools/shoot.mjs examples/water.json --out shots    # 四种截图
node tools/film.mjs pieces/*.json --out shots           # 小品：校验 + 连续画面
node --test tests/
```

没有依赖，没有构建，纯 ES 模块，Node 22 以上；`shoot` 和 `film` 需要本机有 Chrome。

`trials/`、`trials2/`、`trials-pieces/` 是干净的 Opus 5.5 只凭 skill 写出来的，过程见 [EXPERIMENT.md](EXPERIMENT.md)。

## 装进应用

```js
import { summon, mount, validate, validatePiece } from 'pneuma-shuimo';
import 'pneuma-shuimo/player.css';

// 头像
const spirit = summon(el, {
  size: 56,
  pieces,                                             // 通过 validatePiece 的小品，内置的和 Agent 写的一起
  idle: { first: [75e3, 150e3], between: [150e3, 330e3] },
  onPress: openChat,
});
spirit.set('thinking');                               // rest · thinking · working · blank
spirit.set('working');  spirit.done();                // 做完：一笔合口，回到静

// 长出来的东西
const verdict = validate(scriptFromAgent);            // 后端同一份：import { validate } from 'pneuma-shuimo/script'
if (!verdict.ok) return verdict.errors;               // 原样退给 Agent
const sheet = mount(el, scriptFromAgent, { state, kept, onState: save, onKeep: setKept });
```

- 颜色和字体用 CSS 变量：`--shuimo-paper` `--shuimo-ink` `--shuimo-cinnabar` `--shuimo-font`。墨色取容器的 `color`。
- 类型在 `src/index.d.ts`。
- Agent 侧：把 `skill/` 和 `tools/` 给它，它写 JSON、跑校验、看图、交付。

## 还没做的

- **头像和长出来的东西还是两个圆。** `mount()` 自己画了一个圆；应当由 `summon()` 的那个圆拉出那一笔。
- 头像没有被拖动、观测、飞行这些（super-assistant 的灵已经有）；这里只做了"它自己是活的"这一半。
- 深色的纸只换了墨色，没调过；没有"纸气"（墨在深色背景上的那圈纸色）。
- 长出来的东西宽度固定 460px；只有四种行，没有数字输入、选择、时间。
- 清单会按 `max` 预留空白；条目不能单独删除。
- 没有 Agent 写完之后的"看了再留"界面（试播、留下、删掉）。

## 许可

MIT。
