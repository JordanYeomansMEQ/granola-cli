import type { ProseMirrorDoc } from '../../src/types.js';

export const emptyDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [],
};

export const simpleDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello, world!' }],
    },
  ],
};

export const headingDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Main Title' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Subtitle' }],
    },
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'Section' }],
    },
  ],
};

export const bulletListDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'First item' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Second item' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Third item' }],
            },
          ],
        },
      ],
    },
  ],
};

export const orderedListDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Step one' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Step two' }],
            },
          ],
        },
      ],
    },
  ],
};

export const blockquoteDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This is a quote.' }],
        },
      ],
    },
  ],
};

export const codeBlockDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'codeBlock',
      attrs: { language: 'typescript' },
      content: [{ type: 'text', text: 'const x = 42;' }],
    },
  ],
};

export const horizontalRuleDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Before' }],
    },
    {
      type: 'horizontalRule',
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'After' }],
    },
  ],
};

export const formattedTextDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Normal ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'code', marks: [{ type: 'code' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'strikethrough', marks: [{ type: 'strike' }] },
      ],
    },
  ],
};

export const complexDoc: ProseMirrorDoc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Meeting Notes' }],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Key Decisions' }],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Launch date: ', marks: [{ type: 'bold' }] },
                { type: 'text', text: 'January 15th' },
              ],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Budget approved' }],
            },
          ],
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Action Items' }],
    },
    {
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Update roadmap' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Schedule review' }],
            },
          ],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Important note from stakeholder' }],
        },
      ],
    },
  ],
};
