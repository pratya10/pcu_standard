import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { getLogoUrl } from './branding'
import { getTopicPhotoUrl } from './topicPhotos'
import { formatAvg, type TopicAggregate } from './aggregate'
import { formatThaiDate } from './thaiDate'
import type { AssessmentRound, Facility, FullStandard, Participant, Topic, TopicEvidenceItem, TopicPhoto, TopicScoreItem } from '../types'

type TopicWithEvidence = Topic & { evidence: TopicEvidenceItem[]; scoreItems: TopicScoreItem[] }

export type ReportDocxInput = {
  round: AssessmentRound
  facility: Facility | null
  standard: FullStandard
  aggregates: Map<string, TopicAggregate>
  evaluators: Participant[]
  grandTotal: number
  mustFailCount: number
  includeComments?: boolean
  photosByTopicAndItem?: Map<string, Map<string, TopicPhoto[]>>
}

// Caps how many photos get embedded per topic / for the whole document, so a
// heavily-photographed round doesn't produce an unreasonably large .docx.
const MAX_IMAGES_PER_TOPIC = 6
const MAX_IMAGES_TOTAL = 60

// No outer box, no column rule — just a dotted line between rows, matching
// the plain "line-item list" look the printed/on-screen report also uses.
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const
const DOTTED_ROW_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideVertical: NO_BORDER,
  insideHorizontal: { style: BorderStyle.DOTTED, size: 4, color: 'auto' },
} as const

type LogoAsset = {
  data: Uint8Array
  type: 'jpg' | 'png' | 'gif' | 'bmp'
  width: number
  height: number
}

const CONTENT_TYPE_MAP: Record<string, LogoAsset['type']> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
}

const TARGET_LOGO_WIDTH = 340 // px, ~30% larger than the previous fixed size
const TARGET_PHOTO_WIDTH = 110 // px, small inline thumbnail for evidence photos

async function tryFetchImage(url: string): Promise<LogoAsset | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const type = CONTENT_TYPE_MAP[res.headers.get('content-type') ?? '']
    // docx's ImageRun only embeds jpg/png/gif/bmp directly; skip anything
    // else (e.g. webp, svg) rather than risk a corrupt/distorted embed.
    if (!type) return null

    const buf = await res.arrayBuffer()
    const bitmap = await createImageBitmap(new Blob([buf]))
    const { width, height } = bitmap
    bitmap.close()
    if (!width || !height) return null

    return { data: new Uint8Array(buf), type, width, height }
  } catch {
    return null
  }
}

function scaledSize(natural: { width: number; height: number }, targetWidth: number) {
  const width = targetWidth
  const height = Math.round((natural.height / natural.width) * width)
  return { width, height }
}

function cell(text: string, opts: { bold?: boolean; width?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold })],
      }),
    ],
  })
}

function signatureCell(lines: string[]) {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: lines.map(
      (line, i) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: i === 0 ? { after: 400 } : undefined,
          children: [new TextRun({ text: line })],
        }),
    ),
  })
}

function categoryTopics(cat: FullStandard['categories'][number]): TopicWithEvidence[] {
  return [...cat.topics, ...cat.groups.flatMap((g) => g.topics)]
}

function commentCell(heading: string | null, lines: string[], images: LogoAsset[], checked?: boolean | null) {
  const paragraphs: Paragraph[] = []
  if (checked !== undefined && checked !== null) {
    // Same green/red pill the web page uses for a sub-item's ใช่/ไม่ result —
    // docx has no rounded-corner shading, so a plain colored highlight
    // behind bold white text is the closest equivalent.
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: checked ? ' ใช่ ' : ' ไม่ ', bold: true, color: 'FFFFFF', shading: { fill: checked ? '10B981' : 'F87171' } }),
          ...(heading ? [new TextRun({ text: `  ${heading}`, bold: true, size: 20 })] : []),
        ],
      }),
    )
  } else if (heading) {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: heading, bold: true, size: 20 })] }))
  }
  paragraphs.push(
    ...lines.map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line, italics: true, size: 20, color: '475569' })],
        }),
    ),
  )
  if (images.length) {
    paragraphs.push(
      new Paragraph({
        children: images.flatMap((img, i) => [
          new ImageRun({ data: img.data, transformation: scaledSize(img, TARGET_PHOTO_WIDTH), type: img.type }),
          ...(i < images.length - 1 ? [new TextRun({ text: '  ' })] : []),
        ]),
      }),
    )
  }
  return new TableCell({
    columnSpan: 3,
    shading: { fill: 'F8FAFC' },
    children: paragraphs,
  })
}

// "ความคิดเห็นที่ N : ... โดย ..." — one evaluator's comment per line, numbered
// within its own group (general topic comments and each sub-item's comments
// are numbered separately), with no extra status text.
function buildCommentLines(
  agg: TopicAggregate | undefined,
  evaluatorNameById: Map<string, string>,
  pick: (s: TopicAggregate['scores'][number]) => string | null | undefined,
): string[] {
  if (!agg) return []
  const lines: string[] = []
  let n = 0
  for (const s of agg.scores) {
    const comment = pick(s)
    if (!comment) continue
    n++
    const name = evaluatorNameById.get(s.participant_id) ?? 'กรรมการ'
    lines.push(`ความคิดเห็นที่ ${n} : ${comment} โดย ${name}`)
  }
  return lines
}

// Majority vote across whoever touched this item — same rule aggregate.ts
// uses for a topic's overall Must result — since average mode can have
// several evaluators' own checked states for one item.
function itemCheckedFinal(agg: TopicAggregate | undefined, itemId: string): boolean | null {
  if (!agg) return null
  const checks: boolean[] = []
  for (const s of agg.scores) {
    const note = s.item_notes?.[itemId]
    if (!note) continue
    checks.push(note.checked)
  }
  return checks.length === 0 ? null : checks.filter(Boolean).length / checks.length >= 0.5
}

async function fetchPhotoAssets(photos: TopicPhoto[], imagesLeftTotal: { count: number }): Promise<LogoAsset[]> {
  const assets: LogoAsset[] = []
  for (const p of photos.slice(0, MAX_IMAGES_PER_TOPIC)) {
    if (imagesLeftTotal.count <= 0) break
    const asset = await tryFetchImage(getTopicPhotoUrl(p.file_path))
    if (asset) {
      assets.push(asset)
      imagesLeftTotal.count--
    }
  }
  return assets
}

export async function generateReportDocx(input: ReportDocxInput): Promise<Blob> {
  const { round, facility, standard, aggregates, evaluators, grandTotal, mustFailCount, includeComments, photosByTopicAndItem } = input
  const evaluatorNameById = new Map(evaluators.map((e) => [e.id, e.name]))
  const imagesLeftTotal = { count: MAX_IMAGES_TOTAL }
  const logo = await tryFetchImage(getLogoUrl())

  const children: (Paragraph | Table)[] = []

  if (logo) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: logo.data, transformation: scaledSize(logo, TARGET_LOGO_WIDTH), type: logo.type })],
      }),
    )
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'รายงานผลการประเมินมาตรฐานหน่วยบริการปฐมภูมิ', bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: standard.standardVersion.name, color: '666666' })],
    }),
    new Paragraph({ text: '' }),
  )

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: DOTTED_ROW_BORDERS,
      rows: [
        new TableRow({ children: [cell('หน่วยบริการ', { bold: true, width: 30 }), cell(facility?.name ?? '-', { width: 70 })] }),
        new TableRow({
          children: [
            cell('รหัสหน่วยบริการปฐมภูมิ', { bold: true }),
            cell(`${facility?.pcu_code ?? '-'} ( รหัสสถานพยาบาล ${facility?.code ?? '-'} )`),
          ],
        }),
        new TableRow({ children: [cell('รอบการประเมิน', { bold: true }), cell(round.name)] }),
        new TableRow({ children: [cell('วันที่ประเมิน', { bold: true }), cell(formatThaiDate(round.survey_date))] }),
        new TableRow({
          children: [cell('คณะกรรมการผู้ประเมิน', { bold: true }), cell(evaluators.map((e) => e.name).join(', ') || '-')],
        }),
      ],
    }),
    new Paragraph({ text: '' }),
  )

  for (const cat of standard.categories) {
    const topics = categoryTopics(cat)
    const catTotal = topics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0)
    const catPass = topics.every((t) => aggregates.get(t.id)?.mustPassFinal !== false)

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `หมวดที่ ${cat.code} · ${cat.name_th}`, bold: true })],
      }),
    )

    const rows = [
      new TableRow({
        tableHeader: true,
        children: [
          cell('หัวข้อ', { bold: true, width: 60 }),
          cell('มาตรฐานพื้นฐาน', { bold: true, width: 20, align: AlignmentType.CENTER }),
          cell('การพัฒนาต่อเนื่อง', { bold: true, width: 20, align: AlignmentType.CENTER }),
        ],
      }),
    ]
    for (const t of topics) {
      const agg = aggregates.get(t.id)
      const mustLabel = agg?.mustPassFinal === null || agg?.mustPassFinal === undefined ? '-' : agg.mustPassFinal ? 'ผ่าน' : 'ไม่ผ่าน'
      rows.push(
        new TableRow({
          children: [
            cell(`${t.code}  ${t.name_th}`, { width: 60 }),
            cell(mustLabel, { width: 20, align: AlignmentType.CENTER }),
            cell(formatAvg(agg?.avgScore ?? null), { width: 20, align: AlignmentType.CENTER }),
          ],
        }),
      )
      if (includeComments) {
        const generalLines = buildCommentLines(agg, evaluatorNameById, (s) => s.comment)
        if (generalLines.length) {
          rows.push(new TableRow({ children: [commentCell(null, generalLines, [])] }))
        }
        for (const item of t.scoreItems) {
          const itemLines = buildCommentLines(agg, evaluatorNameById, (s) => s.item_notes?.[item.id]?.comment)
          const itemPhotos = photosByTopicAndItem?.get(t.id)?.get(item.id) ?? []
          const images = await fetchPhotoAssets(itemPhotos, imagesLeftTotal)
          const checked = itemCheckedFinal(agg, item.id)
          if (itemLines.length || images.length || checked !== null) {
            rows.push(new TableRow({ children: [commentCell(item.item_text, itemLines, images, checked)] }))
          }
        }
      }
    }
    rows.push(
      new TableRow({
        children: [
          cell('รวม', { bold: true, width: 60 }),
          cell(catPass ? 'ผ่าน' : 'ไม่ผ่าน', { bold: true, width: 20, align: AlignmentType.CENTER }),
          cell(catTotal.toFixed(1), { bold: true, width: 20, align: AlignmentType.CENTER }),
        ],
      }),
    )

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: DOTTED_ROW_BORDERS, rows }), new Paragraph({ text: '' }))
  }

  const overallPass = mustFailCount === 0
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'สรุปผลการประเมินภาพรวม', bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${Math.round(grandTotal)} คะแนน`, bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: overallPass ? 'ผ่านเกณฑ์ มาตรฐานพื้นฐานครบทุกหัวข้อ' : `ไม่ผ่านเกณฑ์ มาตรฐานพื้นฐาน จำนวน ${mustFailCount} หัวข้อ`,
          bold: true,
          color: overallPass ? '059669' : 'DC2626',
        }),
      ],
    }),
    new Paragraph({ text: '' }),
    new Paragraph({ text: '' }),
  )

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: 'none', size: 0, color: 'FFFFFF' },
        bottom: { style: 'none', size: 0, color: 'FFFFFF' },
        left: { style: 'none', size: 0, color: 'FFFFFF' },
        right: { style: 'none', size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: 'none', size: 0, color: 'FFFFFF' },
        insideVertical: { style: 'none', size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: [
            signatureCell(['ลงชื่อ .............................................', 'ประธานคณะกรรมการประเมิน']),
            signatureCell(['ลงชื่อ .............................................', 'ผู้อำนวยการหน่วยบริการ']),
          ],
        }),
      ],
    }),
  )

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'TH Sarabun PSK' } },
      },
    },
    sections: [{ children }],
  })

  return Packer.toBlob(doc)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
