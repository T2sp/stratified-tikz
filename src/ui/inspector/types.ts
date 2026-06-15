import type { Dispatch, SetStateAction } from 'react'
import type { Diagram } from '../../model/types.ts'

export type DiagramChangeHandler = Dispatch<SetStateAction<Diagram>>
