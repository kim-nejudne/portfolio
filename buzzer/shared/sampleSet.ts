// The built-in sample set, so the app can be tried before anyone writes questions.
// Two questions use pictures; their bytes live in client/src/lib/sampleImages.ts.

import type { QuestionSet } from './types.js';

/** A picture of a hexagon, for question 4. */
export const SAMPLE_HEXAGON_ID = 'sample-img-hexagon';
/** The flag of Japan, for question 7, which has no text. */
export const SAMPLE_FLAG_ID = 'sample-img-flag';

/** The sample's set id: hosting it takes its pictures from the bundle (DECISIONS F54). */
export const SAMPLE_SET_ID = 'sample-general-knowledge';

export const SAMPLE_SET: QuestionSet = {
  id: SAMPLE_SET_ID,
  title: 'Sample: General Knowledge',
  questions: [
    {
      id: 'sample-q1',
      text: 'What is the largest planet in our solar system?',
      answer: 'Jupiter',
      points: 100,
    },
    {
      id: 'sample-q2',
      text: 'Which element has the chemical symbol "O"?',
      answer: 'Oxygen',
      points: 100,
    },
    {
      id: 'sample-q3',
      text: 'In which country would you find the ancient city of Petra?',
      answer: 'Jordan',
      points: 100,
    },
    {
      id: 'sample-q4',
      text: 'How many sides does this shape have?',
      imageId: SAMPLE_HEXAGON_ID,
      answer: 'Six',
      hostNotes: 'A hexagon.',
      points: 100,
    },
    {
      id: 'sample-q5',
      text: 'Who painted the Mona Lisa?',
      answer: 'Leonardo da Vinci',
      points: 100,
    },
    {
      id: 'sample-q6',
      text: 'What is the capital city of Canada?',
      answer: 'Ottawa',
      hostNotes: 'Not Toronto, the largest city.',
      points: 100,
    },
    {
      id: 'sample-q7',
      text: '',
      imageId: SAMPLE_FLAG_ID,
      answer: 'Japan',
      hostNotes: 'Ask: "Which country\'s flag is this?"',
      points: 100,
    },
    {
      id: 'sample-q8',
      text: 'How many minutes are there in a full day?',
      answer: '1440',
      hostNotes: '24 × 60.',
      points: 200,
    },
    {
      id: 'sample-q9',
      text: 'Which ocean lies between Africa and Australia?',
      answer: 'The Indian Ocean',
      points: 200,
    },
    {
      id: 'sample-q10',
      text: 'In what year did the first person walk on the Moon?',
      answer: '1969',
      hostNotes: 'Neil Armstrong, Apollo 11, 20 July 1969.',
      points: 300,
    },
  ],
  createdAt: 0,
  updatedAt: 0,
  schemaVersion: 1,
};
