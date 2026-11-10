/** 脚本，format 1。Agent 写的就是这个；见 skill/SKILL.md。 */
export interface InkDaoScript {
  format?: 1;
  /** 小写短横线命名，最多 40 字符。 */
  id: string;
  /** 两到四个字的名字，最多 8 个字宽。 */
  title: string;
  /** 主人的原话，或这样东西为什么而生。 */
  intent?: string;
  /** 1 到 6 行；entry 行只能有一行且在最后。 */
  rows: Row[];
  ink?: Ink;
  /** 印文，一个汉字。 */
  seal?: string;
  resets?: 'never' | 'daily' | 'weekly';
  /** 0.6（利落）到 1.6（从容），默认 1。 */
  pace?: number;
}
export type Row =
  | { kind: 'text'; text: string; tone?: 'plain' | 'faint'; pause?: number }
  | { kind: 'check'; key: string; label: string; pause?: number }
  | { kind: 'tally'; key: string; label: string; goal?: number; unit?: string; pause?: number }
  | { kind: 'entry'; key: string; placeholder: string; max?: number; items?: string[]; pause?: number };
export type Ink = ({ motif: MotifName; strokes?: never } | { strokes: Stroke[]; motif?: never }) & { when?: 'first' | 'last'; mirror?: boolean };
export type MotifName = 'orchid' | 'bamboo' | 'mountain' | 'ripples' | 'moon' | 'plum';
export type PressName = 'plain' | 'dot' | 'press' | 'leaf' | 'hair' | 'fly' | 'ripple' | 'swell' | 'peak' | 'fade' | 'taper';
export type LibertyName = 'free' | 'still' | 'quick' | 'calm' | 'leaf' | 'script' | 'sweep';
export interface Stroke {
  path?: [number, number][];
  circle?: { centre: [number, number]; radius: number; gap?: number; gapAt?: number };
  width: number;
  press?: PressName | [number, number][];
  ink?: number; wet?: number; dry?: number; tint?: number;
  pace?: number; pause?: number;
  liberty?: LibertyName;
}
export type SheetState = Record<string, number | boolean | { text: string; done: boolean }[] | string>;
export interface Plan { width: number; height: number; usable: number; total: number; beats: unknown[]; rows: unknown[] }
export type Verdict = { ok: true; errors: []; warnings: string[]; plan: Plan } | { ok: false; errors: string[]; warnings: string[] };

/** 每份脚本上纸之前都要过的关。错误逐条说明在哪里、怎么改。没有 DOM，前后端同一份。 */
export function validate(script: unknown): Verdict;
export function initialState(script: InkDaoScript): SheetState;
export function compose(script: InkDaoScript): Plan;
export function describe(plan: Plan): string;

export interface MountOptions {
  /** 宿主保存的状态；不给就从空开始。 */
  state?: SheetState;
  /** 是否已钤印留下。 */
  kept?: boolean;
  /** 一开始就展开（默认 true）。false 时只有圆，等主人点。 */
  autoplay?: boolean;
  /** 一次写完，不走时间（减弱动效时自动如此）。 */
  instant?: boolean;
  /** 定格在展开后的第几毫秒，用于检查。 */
  at?: number;
  seed?: number;
  onState?(state: SheetState): void;
  onKeep?(kept: boolean): void;
  onFold?(): void;
}
export interface Sheet {
  readonly el: HTMLElement;
  readonly plan: Plan;
  readonly state: SheetState;
  readonly kept: boolean;
  readonly open: boolean;
  unfold(): void;
  fold(): void;
  destroy(): void;
}
/** 把一份通过校验的脚本放到容器里。脚本没通过会抛错，错里带着全部理由。 */
export function mount(container: HTMLElement, script: InkDaoScript, options?: MountOptions): Sheet;

export const MOTIF_NAMES: MotifName[];
export const MOTIFS: Record<MotifName, { name: string; strokes: Stroke[] }>;
export const LIMITS: Record<string, number>;

/** 小品：头像自己的一段表演，format 1。见 skill/PIECE.md。 */
export interface Piece {
  format?: 1;
  id: string;
  name: string;
  idea?: string;
  occasion: 'leisure' | 'hover';
  /** keep：圆一直在，和它一起玩；away：圆先干去，结束时重新写出来。 */
  circle: 'keep' | 'away';
  strokes: PieceStroke[];
  /** 闲时的小品被指针碰到时的回应；replaces 指 strokes 里的笔。 */
  answer?: PieceStroke[];
  hold?: number;
}
export interface PieceStroke extends Omit<Stroke, 'width' | 'circle'> {
  width?: number;
  circle?: { centre?: [number, number]; radius?: number; gap?: number; gapAt?: number };
  /** 写完之后过这么久自己干去（毫秒）。 */
  fleeting?: number;
  /** 这一笔开始时，此前写的都干去。 */
  moved?: true;
  /** 这一笔开始时，第 n 笔干去。 */
  replaces?: number | number[];
}
export interface PiecePlan { occasion: 'leisure' | 'hover'; written: number; foldAt: number; total: number; inks: unknown[] }
export type PieceVerdict = { ok: true; errors: []; warnings: string[]; plan: PiecePlan } | { ok: false; errors: string[]; warnings: string[] };
export function validatePiece(piece: unknown): PieceVerdict;
export function composePiece(piece: Piece, occasion?: 'leisure' | 'hover'): PiecePlan;
export function describePiece(plan: PiecePlan): string;

export interface SummonOptions {
  /** 头像的边长（px），默认 56。纸是它的三倍，不接收鼠标。 */
  size?: number;
  /** 它会演的小品；按 occasion 分到闲时和指针下。 */
  pieces?: Piece[];
  /** 闲时多久写一幅（毫秒区间）；不给就不自己写。 */
  idle?: { first: [number, number]; between: [number, number] } | false;
  seed?: number;
  label?: string;
  /** 定格：某一幅在某一刻的样子，不走时钟。 */
  at?: { piece?: Piece; occasion?: 'leisure' | 'hover'; t?: number; answer?: number };
  onPress?(): void;
  onRest?(): void;
}
export interface Spirit {
  readonly el: HTMLElement;
  readonly state: 'rest' | 'thinking' | 'working' | 'blank';
  readonly busy: boolean;
  /** rest 静；thinking 在想（圆一遍遍重写）；working 在做事（笔在圆里一段段地走）；blank 放空（墨淡成一道痕）。 */
  set(state: 'rest' | 'thinking' | 'working' | 'blank'): void;
  /** 事情做完了：一笔合上口，停一拍干去，回到静。 */
  done(): void;
  /** 像有指针在那边一样看过去（相对圆心的像素）；unlook 让点干去。 */
  look(dx: number, dy: number): void;
  unlook(): void;
  play(piece: Piece, occasion?: 'leisure' | 'hover', over?: { hold?: number }): boolean;
  giveWay(): void;
  destroy(): void;
}
/** 助理的头像：一个活的墨圆。 */
export function summon(container: HTMLElement, options?: SummonOptions): Spirit;
