import figma from '@figma/code-connect';
import { RobotNotificationsSection } from './robot-notifications-section';

figma.connect(
  RobotNotificationsSection,
  'https://www.figma.com/design/4M6ZJeHGYWaNO9bODM7Pou/Joy?node-id=697-1980',
  {
    props: {
      sectionTitle: figma.string('Section Title'),
      cardTitle: figma.string('Card Title'),
      description: figma.string('Description'),
    },
    example: (props) => (
      <RobotNotificationsSection
        sectionTitle={props.sectionTitle}
        cardTitle={props.cardTitle}
        description={props.description}
      />
    ),
  }
);
