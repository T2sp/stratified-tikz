import { useId, useState } from 'react'
import { pointNodeAnchorIssue } from '../../geometry/pointNodeShapes/index.ts'
import { isPointNodeAnchorLiteral, markPointLayoutOverrides, resolvePointNodeLayoutOptions, updatePointNodeDimension } from '../../model/pointNodeLayout.ts'
import type { PointNodeDimensionField, PointStyle } from '../../model/types.ts'

const dimensions: readonly { label: string; fields: readonly PointNodeDimensionField[] }[] = [
  { label: 'Inner sep', fields: ['innerXSep', 'innerYSep'] },
  { label: 'Inner xsep', fields: ['innerXSep'] }, { label: 'Inner ysep', fields: ['innerYSep'] },
  { label: 'Outer sep', fields: ['outerXSep', 'outerYSep'] },
  { label: 'Outer xsep', fields: ['outerXSep'] }, { label: 'Outer ysep', fields: ['outerYSep'] },
  { label: 'Minimum size', fields: ['minimumWidth', 'minimumHeight'] },
  { label: 'Minimum width', fields: ['minimumWidth'] }, { label: 'Minimum height', fields: ['minimumHeight'] },
]
export function PointLayoutFields({ style, prefix = '', onChange }: {
  style: PointStyle; prefix?: string; onChange: (style: PointStyle) => void
}) {
  const resolved = resolvePointNodeLayoutOptions(style)
  const anchorIssue = pointNodeAnchorIssue(style.shape, resolved.anchor, style.shapeParameters)
  return <>
    {dimensions.map(({ label, fields }) => {
      const values = fields.map((field) => style.layout?.[field])
      const same = values.every((value) => value === values[0])
      const committed = same && values[0] !== undefined ? style.layout?.units?.[fields[0]]?.source ?? `${values[0]}pt` : ''
      const defaults = fields.map((field) => `${resolved[field]}pt`).join(' / ')
      return <PointLayoutTextField key={label} label={`${prefix}${label}`} value={committed}
        placeholder={same ? `Default ${defaults}` : `Axes ${defaults}`}
        invalidMessage="Enter a finite dimension within ±10000pt using pt, mm, cm, in, bp, em or ex; blank restores the default."
        validate={(draft) => updatePointNodeDimension(style, fields, draft) !== null}
        onChange={(draft) => { const next = updatePointNodeDimension(style, fields, draft); if (next) onChange(next) }} />
    })}
    <PointLayoutTextField label={`${prefix}Anchor`} value={style.layout?.anchor ?? ''} placeholder="center"
      invalidMessage="Enter a literal anchor name or numeric border angle; supported anchors depend on the shape."
      validate={(draft) => draft === '' || isPointNodeAnchorLiteral(draft)}
      onChange={(anchor) => {
        const layout = { ...style.layout }
        if (anchor === '') delete layout.anchor
        else layout.anchor = anchor
        onChange(markPointLayoutOverrides({ ...style, layout }, ['anchor']))
      }} />
    {anchorIssue && <p className="style-preset-warning" role="status">{anchorIssue} The source anchor is retained for TikZ.</p>}
    <p className="inspector-hint">Dimensions use TeX points (72.27pt/in). em/ex use the recorded font context. Blank fields inherit defaults; explicit axes override legacy size/2. Outer separation follows the shape’s PGF anchor rules; diamond also adjusts its painted contour.</p>
  </>
}

function PointLayoutTextField({ label, value, placeholder, invalidMessage, validate, onChange }: {
  label: string; value: string; placeholder: string; invalidMessage: string; validate: (draft: string) => boolean; onChange: (draft: string) => void
}) {
  const warningId = useId()
  const [draft, setDraft] = useState({ committed: value, text: value })
  if (draft.committed !== value) setDraft({ committed: value, text: value })
  const text = draft.committed === value ? draft.text : value
  const invalid = !validate(text)
  return <label className="inspector-field">
    <span className="inspector-field-label">{label}</span>
    <input className="inspector-input" type="text" value={text} placeholder={placeholder} spellCheck={false}
      aria-invalid={invalid} aria-describedby={invalid ? warningId : undefined}
      onChange={(event) => {
        const next = event.currentTarget.value
        setDraft({ committed: value, text: next })
        if (validate(next)) onChange(next)
      }} />
    {invalid && <span id={warningId} className="inspector-field-error" role="status">{invalidMessage}</span>}
  </label>
}
