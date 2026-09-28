import { lineStyles, pointStrokeCaps, pointStrokeJoins } from '../../model/types.ts'
import type { HexColor, PointPaint, PointPaintField, PointStyle } from '../../model/types.ts'
import { clonePointPaint, getPointPaint, markPointPaintOverrides } from '../../model/styles.ts'
import {
  EditableColorField,
  EditableNumberField,
  EditableOpacityField,
  EditablePositiveNumberField,
  EditableSelectField,
} from './InspectorField.tsx'

/** Shared by the live point inspector and saved-preset editor. */
export function PointPaintFields({ style, onChange, prefix = '' }: {
  style: PointStyle
  onChange: (style: PointStyle, fields: readonly PointPaintField[]) => void
  prefix?: string
}) {
  const paint = getPointPaint(style)
  const label = (name: string) => `${prefix}${name}`
  const update = (fields: readonly PointPaintField[], change: (next: PointPaint) => void) => {
    const next = clonePointPaint(paint)
    change(next)
    onChange(markPointPaintOverrides({ ...style, paint: next }, fields), fields)
  }
  return <>
    <EditableColorField label={label('Text color')} value={paint.text.color}
      onChange={(color) => update(['text.color'], (next) => { next.text.color = color as HexColor })} />
    <EditableOpacityField label={label('Text opacity')} value={paint.text.opacity}
      onChange={(opacity) => update(['text.opacity'], (next) => { next.text.opacity = opacity })} />
    <label className="inspector-field">
      <span className="inspector-field-label">{label('Fill enabled')}</span>
      <input type="checkbox" checked={paint.fill.enabled}
        onChange={(event) => update(['fill.enabled'], (next) => { next.fill.enabled = event.currentTarget.checked })} />
    </label>
    <EditableColorField label={label('Fill color')} value={paint.fill.color}
      onChange={(color) => update(['fill.color'], (next) => { next.fill.color = color as HexColor })} />
    <EditableOpacityField label={label('Fill opacity')} value={paint.fill.opacity}
      onChange={(opacity) => update(['fill.opacity'], (next) => { next.fill.opacity = opacity })} />
    <label className="inspector-field">
      <span className="inspector-field-label">{label('Border enabled')}</span>
      <input type="checkbox" checked={paint.stroke.enabled}
        onChange={(event) => update(['stroke.enabled'], (next) => { next.stroke.enabled = event.currentTarget.checked })} />
    </label>
    <EditableColorField label={label('Border color')} value={paint.stroke.color}
      onChange={(color) => update(['stroke.color'], (next) => { next.stroke.color = color as HexColor })} />
    <EditableOpacityField label={label('Border opacity')} value={paint.stroke.opacity}
      onChange={(opacity) => update(['stroke.opacity'], (next) => { next.stroke.opacity = opacity })} />
    <EditablePositiveNumberField label={label('Border width')} value={paint.stroke.width}
      onChange={(width) => update(['stroke.width'], (next) => { next.stroke.width = width })} />
    <EditableSelectField label={label('Border line style')} value={paint.stroke.lineStyle} options={lineStyles}
      onChange={(lineStyle) => update(['stroke.lineStyle', 'stroke.dashPattern'], (next) => { next.stroke.lineStyle = lineStyle; delete next.stroke.dashPattern })} />
    <EditableNumberField label={label('Border dash phase')} value={paint.stroke.dashPhase}
      onChange={(dashPhase) => update(['stroke.dashPhase'], (next) => { next.stroke.dashPhase = dashPhase })} />
    <EditableSelectField label={label('Border cap')} value={paint.stroke.lineCap} options={pointStrokeCaps}
      onChange={(lineCap) => update(['stroke.lineCap'], (next) => { next.stroke.lineCap = lineCap })} />
    <EditableSelectField label={label('Border join')} value={paint.stroke.lineJoin} options={pointStrokeJoins}
      onChange={(lineJoin) => update(['stroke.lineJoin'], (next) => { next.stroke.lineJoin = lineJoin })} />
  </>
}
