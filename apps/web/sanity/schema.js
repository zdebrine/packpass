// The Sanity schema for the site's content (src/content/defaults.ts has the same shape). Deployed to project
// 17ja5m2z with the Sanity MCP deploy_schema tool, which takes plain object literals, then deploy_studio
// (packpass.sanity.studio). To change a field: edit it here and in defaults.ts, then deploy this file again.

{
  name: 'card',
  title: 'Card',
  type: 'object',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'body',
      title: 'Text',
      type: 'text',
      rows: 3,
    },
  ],
}

{
  name: 'iconCard',
  title: 'Card with icon',
  type: 'object',
  fields: [
    {
      name: 'icon',
      title: 'Icon',
      type: 'string',
      options: {
        list: [
          'Banknote',
          'Calendar',
          'CalendarCheck',
          'CalendarPlus',
          'Clock',
          'Coins',
          'Dog',
          'Flame',
          'Heart',
          'Landmark',
          'MapPin',
          'MessageSquareText',
          'ShieldCheck',
          'Sparkles',
          'Star',
          'TrendingUp',
          'UserPlus',
          'Users',
        ],
      },
    },
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'body',
      title: 'Text',
      type: 'text',
      rows: 3,
    },
  ],
}

{
  name: 'faqItem',
  title: 'Question',
  type: 'object',
  fields: [
    {
      name: 'question',
      title: 'Question',
      type: 'string',
    },
    {
      name: 'answer',
      title: 'Answer',
      type: 'text',
      rows: 4,
    },
  ],
}

{
  name: 'classTile',
  title: 'Class tile',
  type: 'object',
  fields: [
    {
      name: 'label',
      title: 'Class',
      type: 'string',
    },
    {
      name: 'sub',
      title: 'Payoff line',
      type: 'string',
    },
    {
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Describe the photo for screen readers and search. Leave empty if it is decorative.',
        },
      ],
    },
  ],
}

{
  name: 'stat',
  title: 'Stat',
  type: 'object',
  fields: [
    {
      name: 'value',
      title: 'Value',
      type: 'string',
    },
    {
      name: 'label',
      title: 'Label',
      type: 'string',
    },
  ],
}

{
  name: 'plan',
  title: 'Plan',
  type: 'object',
  fields: [
    {
      name: 'key',
      title: 'Plan',
      type: 'string',
      description: 'Which plan this is in the app. Keep one of each.',
      options: {
        list: [
          'starter',
          'regular',
          'working',
        ],
      },
    },
    {
      name: 'name',
      title: 'Name',
      type: 'string',
    },
    {
      name: 'price',
      title: 'Price',
      type: 'string',
      description: 'As shown, e.g. $129',
    },
    {
      name: 'credits',
      title: 'Credits a month',
      type: 'number',
    },
    {
      name: 'fit',
      title: 'Who it fits',
      type: 'text',
      rows: 2,
    },
    {
      name: 'popular',
      title: 'Highlight as the best fit',
      type: 'boolean',
    },
  ],
}

{
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  description: 'Anything left empty shows the built-in copy.',
  fields: [
    {
      name: 'ownerTitle',
      title: 'Owners page title',
      type: 'string',
      description: 'Browser tab and search result title for /.',
    },
    {
      name: 'partnerTitle',
      title: 'Partners page title',
      type: 'string',
      description: 'Browser tab and search result title for /partners.',
    },
    {
      name: 'description',
      title: 'Share description',
      type: 'text',
      rows: 3,
      description: 'Shown in search results and link previews.',
    },
    {
      name: 'shareImage',
      title: 'Share image',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Describe the photo for screen readers and search. Leave empty if it is decorative.',
        },
      ],
    },
    {
      name: 'badge',
      title: 'Top bar badge',
      type: 'string',
      description: 'e.g. Now in Austin',
    },
    {
      name: 'footerTagline',
      title: 'Footer line',
      type: 'string',
    },
  ],
}

{
  name: 'ownersPage',
  title: 'Owners page',
  type: 'document',
  description: 'Anything left empty shows the built-in copy.',
  fields: [
    {
      name: 'hero',
      title: 'Hero',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
        },
        {
          name: 'variant',
          title: 'Headline style',
          type: 'string',
          options: {
            list: [
              { title: 'Rotating: lead line plus one line per photo', value: 'rotating' },
              { title: 'Static: one headline', value: 'static' },
            ],
            layout: 'radio',
          },
          description: 'Rotating shows the lead line, then each photo\'s rotating line. Static shows the headline only.',
        },
        {
          name: 'lead',
          title: 'Rotating lead line',
          type: 'string',
          description: 'The fixed first line of the rotating headline, e.g. "The dog you can take". Keep it short.',
        },
        {
          name: 'headline',
          title: 'Headline',
          type: 'string',
          description: 'The full headline. Shown as is in the static style. In the rotating style it is what screen readers and search engines read.',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 3,
        },
        {
          name: 'cta',
          title: 'Button',
          type: 'string',
        },
        {
          name: 'matchCta',
          title: 'Match button',
          type: 'string',
        },
        {
          name: 'slides',
          title: 'Photos',
          type: 'array',
          of: [
            {
              type: 'image',
              options: {
                hotspot: true,
              },
              fields: [
                {
                  name: 'alt',
                  title: 'Alt text',
                  type: 'string',
                },
                {
                  name: 'line',
                  title: 'Rotating line',
                  type: 'string',
                  description: 'Shown under the lead line while this photo is up (rotating style only). End with a period. Keep it to about 20 characters so it fits in two lines on phones.',
                },
              ],
            },
          ],
          description: 'They cross-fade in this order.',
        },
      ],
    },
    {
      name: 'match',
      title: 'Matched to your dog',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
      ],
    },
    {
      name: 'how',
      title: 'How it works',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'steps',
          title: 'Steps',
          type: 'array',
          of: [
            {
              type: 'card',
            },
          ],
          description: 'Numbered 01, 02, 03 in order.',
        },
      ],
    },
    {
      name: 'classes',
      title: 'Classes',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 3,
        },
        {
          name: 'tiles',
          title: 'Tiles',
          type: 'array',
          of: [
            {
              type: 'classTile',
            },
          ],
        },
      ],
    },
    {
      name: 'partners',
      title: 'Partners near you',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 3,
          description: 'The partner cards themselves come from the live catalog.',
        },
      ],
    },
    {
      name: 'passport',
      title: 'Dog Passport',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 3,
        },
        {
          name: 'rows',
          title: 'Rows',
          type: 'array',
          of: [
            {
              type: 'iconCard',
            },
          ],
        },
        {
          name: 'dog',
          title: 'Athlete card',
          type: 'object',
          options: {
            collapsible: true,
            collapsed: true,
          },
          fields: [
            {
              name: 'name',
              title: 'Name',
              type: 'string',
            },
            {
              name: 'sub',
              title: 'Breed and age',
              type: 'string',
            },
            {
              name: 'since',
              title: 'Since tag',
              type: 'string',
            },
            {
              name: 'streak',
              title: 'Streak tag',
              type: 'string',
            },
            {
              name: 'photo',
              title: 'Photo',
              type: 'image',
              options: {
                hotspot: true,
              },
              fields: [
                {
                  name: 'alt',
                  title: 'Alt text',
                  type: 'string',
                  description: 'Describe the photo for screen readers and search. Leave empty if it is decorative.',
                },
              ],
            },
            {
              name: 'stats',
              title: 'Stats',
              type: 'array',
              of: [
                {
                  type: 'stat',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'plans',
      title: 'Plans',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 2,
        },
        {
          name: 'popularTag',
          title: 'Highlight tag',
          type: 'string',
        },
        {
          name: 'perks',
          title: 'Included in every plan',
          type: 'array',
          of: [
            {
              type: 'string',
            },
          ],
        },
        {
          name: 'items',
          title: 'Plans',
          type: 'array',
          of: [
            {
              type: 'plan',
            },
          ],
          description: 'Smallest first. The matcher picks the smallest plan that covers the sample month.',
        },
      ],
    },
    {
      name: 'faq',
      title: 'FAQ',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
        },
        {
          name: 'rows',
          title: 'Questions',
          type: 'array',
          of: [
            {
              type: 'faqItem',
            },
          ],
        },
      ],
    },
    {
      name: 'signup',
      title: 'Closing signup',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'photo',
          title: 'Photo',
          type: 'image',
          options: {
            hotspot: true,
          },
          fields: [
            {
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              description: 'Describe the photo for screen readers and search. Leave empty if it is decorative.',
            },
          ],
        },
        {
          name: 'foundingTitle',
          title: 'Heading before launch',
          type: 'string',
        },
        {
          name: 'foundingBody',
          title: 'Text before launch',
          type: 'text',
          rows: 2,
        },
        {
          name: 'liveTitle',
          title: 'Heading once the app is live',
          type: 'string',
        },
        {
          name: 'liveBody',
          title: 'Text once the app is live',
          type: 'text',
          rows: 2,
        },
      ],
    },
  ],
}

{
  name: 'partnersPage',
  title: 'Partners page',
  type: 'document',
  description: 'Anything left empty shows the built-in copy.',
  fields: [
    {
      name: 'hero',
      title: 'Hero',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
        },
        {
          name: 'headline',
          title: 'Headline',
          type: 'string',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 3,
        },
        {
          name: 'cta',
          title: 'Apply button',
          type: 'string',
        },
        {
          name: 'ctaNote',
          title: 'Note next to the button',
          type: 'string',
        },
        {
          name: 'photo',
          title: 'Photo',
          type: 'image',
          options: {
            hotspot: true,
          },
          fields: [
            {
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              description: 'Describe the photo for screen readers and search. Leave empty if it is decorative.',
            },
          ],
        },
        {
          name: 'values',
          title: 'Value cards',
          type: 'array',
          of: [
            {
              type: 'iconCard',
            },
          ],
        },
      ],
    },
    {
      name: 'payouts',
      title: 'How payouts work',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 3,
        },
        {
          name: 'steps',
          title: 'Steps',
          type: 'array',
          of: [
            {
              type: 'iconCard',
            },
          ],
        },
        {
          name: 'example',
          title: 'Example',
          type: 'string',
        },
        {
          name: 'exampleMath',
          title: 'Example math',
          type: 'string',
        },
      ],
    },
    {
      name: 'calculator',
      title: 'Earnings calculator',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'gateBody',
          title: 'Text on the form',
          type: 'text',
          rows: 2,
        },
        {
          name: 'note',
          title: 'Fine print',
          type: 'text',
          rows: 3,
          description: 'The calculator itself uses $9.50 a credit, set in code.',
        },
      ],
    },
    {
      name: 'clients',
      title: 'Grow your client list',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 3,
        },
      ],
    },
    {
      name: 'control',
      title: 'What you control',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'body',
          title: 'Text',
          type: 'text',
          rows: 2,
        },
        {
          name: 'items',
          title: 'Cards',
          type: 'array',
          of: [
            {
              type: 'iconCard',
            },
          ],
        },
      ],
    },
    {
      name: 'join',
      title: 'Getting started',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
          description: 'The small label above the heading.',
        },
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'steps',
          title: 'Steps',
          type: 'array',
          of: [
            {
              type: 'card',
            },
          ],
        },
        {
          name: 'required',
          title: 'Required',
          type: 'array',
          of: [
            {
              type: 'card',
            },
          ],
        },
        {
          name: 'optional',
          title: 'Optional',
          type: 'array',
          of: [
            {
              type: 'card',
            },
          ],
        },
      ],
    },
    {
      name: 'faq',
      title: 'FAQ',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'eyebrow',
          title: 'Eyebrow',
          type: 'string',
        },
        {
          name: 'rows',
          title: 'Questions',
          type: 'array',
          of: [
            {
              type: 'faqItem',
            },
          ],
        },
      ],
    },
    {
      name: 'close',
      title: 'Closing panel',
      type: 'object',
      options: {
        collapsible: true,
        collapsed: true,
      },
      fields: [
        {
          name: 'title',
          title: 'Heading',
          type: 'string',
        },
        {
          name: 'note',
          title: 'Note next to the button',
          type: 'string',
        },
        {
          name: 'photo',
          title: 'Photo',
          type: 'image',
          options: {
            hotspot: true,
          },
          fields: [
            {
              name: 'alt',
              title: 'Alt text',
              type: 'string',
              description: 'Describe the photo for screen readers and search. Leave empty if it is decorative.',
            },
          ],
        },
      ],
    },
  ],
}
