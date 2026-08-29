import figma from '@figma/code-connect';
import { HeroPmoCard } from './hero-pmo-card';

figma.connect(
  HeroPmoCard,
  'https://www.figma.com/design/Ofxfhj3hWqVKSZu9WN7Syy/PMO?node-id=74-1719',
  {
    props: {
      tier: figma.enum('Tier', {
        Cooked: 'cooked',
        Grass: 'grass',
        Mewing: 'mewing',
        Sigma: 'sigma',
        Rizzler: 'rizzler',
        Mogger: 'mogger',
        Aura: 'aura',
        Gigachad: 'gigachad',
        Alpha: 'alpha',
        Ascended: 'ascended',
        GOAT: 'goat',
      }),
    },
    example: (props) => <HeroPmoCard tierOverride={props.tier} />,
  }
);
