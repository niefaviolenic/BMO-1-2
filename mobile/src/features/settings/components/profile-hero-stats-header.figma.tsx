import figma from '@figma/code-connect';
import { ProfileHeroStatsHeader } from './profile-hero-stats-header';

figma.connect(
  ProfileHeroStatsHeader,
  'https://www.figma.com/design/Ofxfhj3hWqVKSZu9WN7Syy/PMO?node-id=242-2706',
  {
    props: {
      name: figma.string('Alex Rivers'),
      planTag: figma.string('PRO'),
      streakSubtext: figma.string('42 Days Streak • Sigma'),
      totalDays: figma.string('941 Days'),
      relapses: figma.string('2'),
      winRate: figma.string('85%'),
    },
    example: (props) => (
      <ProfileHeroStatsHeader
        name={props.name}
        planTag={props.planTag}
        streakSubtext={props.streakSubtext}
        totalDays={props.totalDays}
        relapses={props.relapses}
        winRate={props.winRate}
      />
    ),
  }
);
