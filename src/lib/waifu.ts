import mikuWaifuImage from '../assets/waifu/miku_waifu.png'
import airiWaifuImage from '../assets/waifu/violet_hair_waifu.png'
import type { WaifuId } from '../stores/uiStore'

export interface WaifuOption {
  id: WaifuId
  name: string
  imageUrl: string
  tagline: string
}

export const WAIFU_OPTIONS: WaifuOption[] = [
  {
    id: 'miku',
    name: 'Miku',
    imageUrl: mikuWaifuImage,
    tagline: 'Cyber idol',
  },
  {
    id: 'airi',
    name: 'Airi',
    imageUrl: airiWaifuImage,
    tagline: 'E-girl neon',
  },
]

export function getWaifuById(id: WaifuId): WaifuOption {
  return WAIFU_OPTIONS.find((w) => w.id === id) || WAIFU_OPTIONS[0]
}
