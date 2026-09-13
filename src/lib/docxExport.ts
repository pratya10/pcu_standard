import {
  AlignmentType,
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
import type { AssessmentRound, Facility, FullStandard, Participant, TeamScoreAudit, Topic, TopicEvidenceItem, TopicPhoto, TopicScoreItem } from '../types'
import { formatThaiDateTime } from './thaiDate'

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
  photosByTopic?: Map<string, TopicPhoto[]>
  auditLog?: TeamScoreAudit[]
}

// Caps how many photos get embedded per topic / for the whole document, so a
// heavily-photographed round doesn't produce an unreasonably large .docx.
const MAX_IMAGES_PER_TOPIC = 6
const MAX_IMAGES_TOTAL = 60

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

function commentCell(lines: string[], images: LogoAsset[]) {
  const paragraphs = lines.map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, italics: true, size: 20, color: '475569' })],
      }),
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

function buildCommentLines(agg: TopicAggregate | undefined, topic: TopicWithEvidence, evaluatorNameById: Map<string, string>): string[] {
  if (!agg) return []
  const itemTextById = new Map(topic.scoreItems.map((it) => [it.id, it.item_text]))
  const lines: string[] = []
  for (const s of agg.scores) {
    const name = evaluatorNameById.get(s.participant_id) ?? 'กรรมการ'
    if (s.comment) lines.push(`${name}: ${s.comment}`)
    for (const [itemId, note] of Object.entries(s.item_notes ?? {})) {
      if (note.comment) {
        const itemText = itemTextById.get(itemId) ?? itemId
        lines.push(`${name} (${itemText}): ${note.comment}`)
      }
    }
  }
  return lines
}

async function fetchTopicPhotoAssets(
  topic: TopicWithEvidence,
  photosByTopic: Map<string, TopicPhoto[]> | undefined,
  imagesLeftTotal: { count: number },
): Promise<LogoAsset[]> {
  const photos = (photosByTopic?.get(topic.id) ?? []).slice(0, MAX_IMAGES_PER_TOPIC)
  const assets: LogoAsset[] = []
  for (const p of photos) {
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
  const { round, facility, standard, aggregates, evaluators, grandTotal, mustFailCount, includeComments, photosByTopic, auditLog } = input
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
      rows: [
        new TableRow({ children: [cell('หน่วยบริการ', { bold: true, width: 30 }), cell(facility?.name ?? '-', { width: 70 })] }),
        new TableRow({ children: [cell('รหัสหน่วยบริการ', { bold: true }), cell(facility?.code ?? '-')] }),
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
          cell('The Must', { bold: true, width: 20, align: AlignmentType.CENTER }),
          cell('คะแนน (0-2)', { bold: true, width: 20, align: AlignmentType.CENTER }),
        ],
      }),
    ]
    for (const t of topics) {
      const agg = aggregates.get(t.id)
      const mustLabel = agg?.mustPassFinal === null || agg?.mustPassFinal === undefined ? '-' : agg.mustPassFinal ? 'ผ่าน' : 'ไม่ผ่าน'
      rows.push(
        new TableRow({
          children: [
            cell(`${t.code}  ${t.name_th}`),
            cell(mustLabel, { align: AlignmentType.CENTER }),
            cell(formatAvg(agg?.avgScore ?? null), { align: AlignmentType.CENTER }),
          ],
        }),
      )
      if (includeComments) {
        const commentLines = buildCommentLines(agg, t, evaluatorNameById)
        const images = await fetchTopicPhotoAssets(t, photosByTopic, imagesLeftTotal)
        if (commentLines.length || images.length) {
          rows.push(new TableRow({ children: [commentCell(commentLines, images)] }))
        }
      }
    }
    rows.push(
      new TableRow({
        children: [
          cell('รวม', { bold: true }),
          cell(catPass ? 'ผ่าน' : 'ไม่ผ่าน', { bold: true, align: AlignmentType.CENTER }),
          cell(catTotal.toFixed(1), { bold: true, align: AlignmentType.CENTER }),
        ],
      }),
    )

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }), new Paragraph({ text: '' }))
  }

  if (includeComments && auditLog && auditLog.length > 0) {
    const topicById = new Map(standard.categories.flatMap((cat) => categoryTopics(cat).map((t) => [t.id, t])))
    const itemTextById = new Map(standard.categories.flatMap((cat) => categoryTopics(cat).flatMap((t) => t.scoreItems.map((it) => [it.id, it.item_text]))))
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'ประวัติการแก้ไขคะแนน (โหมดทีมคณะกรรมช่วยกัน)', bold: true })],
      }),
    )
    for (const a of auditLog) {
      const t = topicById.get(a.topic_id)
      const fieldLabel = a.field === 'score' ? 'คะแนน' : a.field === 'must_pass' ? 'ผล The Must' : `ข้อย่อย "${itemTextById.get(a.item_id ?? '') ?? ''}"`
      const describe = (v: unknown) =>
        a.field === 'must_pass' ? (v ? 'ผ่าน' : 'ไม่ผ่าน') : a.field === 'item_checked' ? (v ? 'มี' : 'ไม่มี') : String(v)
      const name = evaluatorNameById.get(a.participant_id ?? '') ?? 'กรรมการ'
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: `${t?.code ?? ''} ${t?.name_th ?? ''} — ${fieldLabel}: เปลี่ยนจาก "${describe(a.old_value)}" เป็น "${describe(a.new_value)}" โดย ${name} เมื่อ ${formatThaiDateTime(a.created_at)}`,
              size: 20,
            }),
          ],
        }),
      )
    }
    children.push(new Paragraph({ text: '' }))
  }

  const overallPass = mustFailCount === 0
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'สรุปผลการประเมินภาพรวม', bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${grandTotal.toFixed(1)} คะแนน`, bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: overallPass ? 'ผ่านเกณฑ์ The Must ครบทุกหัวข้อ' : `ไม่ผ่านเกณฑ์ The Must จำนวน ${mustFailCount} หัวข้อ`,
          bold: true,
          color: overallPass ? '15803D' : 'DC2626',
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
