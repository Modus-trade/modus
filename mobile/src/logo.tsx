import { SvgXml } from 'react-native-svg';
import { LOGO_SVG, TITLE_SVG } from './brand-assets';

/** Логотип «МОДУС ТРЕЙД» с сайта modus-trade.kz (знак + фирменный шрифт). Пропорции 132×42. */
export function Logo({ width = 200 }: { width?: number }) {
  return <SvgXml xml={LOGO_SVG} width={width} height={(width * 42) / 132} />;
}

/** Крупная надпись «МОДУС ТРЕЙД» фирменным шрифтом. Пропорции 473×56. */
export function BrandTitle({ width = 280 }: { width?: number }) {
  return <SvgXml xml={TITLE_SVG} width={width} height={(width * 56) / 473} />;
}
