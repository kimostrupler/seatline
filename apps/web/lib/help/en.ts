import type { HelpContent } from './types';

export const EN: HelpContent = {
  topics: {
    'getting-started': {
      title: 'Getting started',
      summary: 'Create your workspace and get your office into Seatline in a few minutes.',
      steps: [
        {
          title: 'Sign up or try the demo',
          text: [
            'On seatline.ch, choose “Try it free for 30 days”. Sign in with your Microsoft 365 work account, or enter your work e-mail and click the link we send you. No password, no credit card.',
            'Just looking? “Try the demo” opens a sample office you can change freely, without an account.',
          ],
        },
        {
          title: 'Name your workspace',
          text: [
            'The first time you sign in, Seatline asks for your organisation’s name. You become its admin. With Microsoft 365, colleagues from the same organisation join the same workspace automatically.',
          ],
        },
        {
          title: 'Set up your office in two steps',
          text: [
            'Right after that, Seatline asks for your building, the floor’s name and how big the office is (Small 12, Medium 33 or Large 74 desks, or an empty floor). It draws an example office for you; you change it later in Edit layout.',
            'Then choose how your colleagues get in: import an Excel or CSV list, add them one by one, or — with Microsoft 365 — let them come from your directory. The first time you open Map, three short tips show how it works.',
          ],
          image: 'setup',
        },
        {
          title: 'Follow the checklist on Home',
          text: [
            'Home shows a “Get started” checklist: add your building, draw a floor with desks, add your colleagues and give people their desks. Each step has a button that takes you to the right place and ticks itself off.',
            'Home also shows how full each floor is, who still needs a desk and what changed this week.',
          ],
          image: 'home',
        },
      ],
      tips: [
        'The fastest start: let the setup draw an example office, then move desks and rename rooms to match yours.',
        'Everything you change can be undone, and every seat change is kept in the history.',
      ],
    },
    floors: {
      title: 'Buildings and floors',
      summary:
        'Add your buildings and floors, start from an example office or import your architect’s plan.',
      steps: [
        {
          title: 'Add a building and a floor',
          text: [
            'Open Map. In the left panel, click + next to Building, enter a name and address, then + next to Floor. Give the floor a name (e.g. “3rd floor”) and a level number; desk numbers follow the level (3.01, 3.02 …).',
          ],
        },
        {
          title: 'Start from an example office',
          text: [
            'A new floor opens in Edit layout and offers ready-made offices: Small (12 desks), Medium (33) and Large (74), with meeting rooms, offices, a reception and a kitchen.',
            'Pick one, then move, rename or delete whatever doesn’t match. Undo removes the whole example at once. Prefer to draw yourself? Choose “Start with an empty floor”.',
          ],
          image: 'edit-template',
        },
        {
          title: 'Adjust it to your office',
          text: [
            'Drag rooms and desks to where they are, resize rooms by their corners and sides, and rename rooms in the panel on the right. Changes save by themselves.',
          ],
          image: 'edit-example',
        },
        {
          title: 'Or use your architect’s plan',
          text: [
            'In the right panel, open Add plan → Import architect plan and choose a DXF, PDF or picture. Seatline suggests rooms and desks from it; tap a suggestion to leave it out, then import. The plan stays in the background so you can draw over it.',
            'Upload picture just puts an image behind the floor. Set the scale with the ruler (M): drag along a wall whose real length you know, and desks are drawn at their real size.',
          ],
        },
      ],
      tips: [
        'Several similar floors? Use ⋯ → Duplicate floor: same rooms and desks, numbered for the new level, without people.',
        'DWG files: save them as DXF or PDF in your CAD program first.',
      ],
    },
    editor: {
      title: 'Drawing the layout',
      summary: 'Rooms, desks, meeting rooms, kitchens and exits: the tools in Edit layout.',
      steps: [
        {
          title: 'Switch to Edit layout',
          text: [
            'On the map, click Edit layout (top right). The tools appear on the left, the details of what you select on the right. Only editors and admins see this.',
          ],
          image: 'edit',
        },
        {
          title: 'Draw rooms and place desks',
          text: [
            'Draw rectangular room (B): drag a rectangle. Draw room by corners (P): click each corner, double-click to finish. Add seat (S): click wherever a desk is. Select a room to give it a name, a type (office, open space, meeting room) and, for meeting rooms, capacity and equipment.',
          ],
        },
        {
          title: 'Kitchens, printers and exits',
          text: [
            'Add a marker (K) and click where the kitchen, printer, exit or first-aid kit is, then choose what it is on the right. Markers help people find their way on the map.',
          ],
        },
        {
          title: 'Numbering, copying and undo',
          text: [
            'Desk numbers follow the floor (3.01, 3.02 …) or the room (12-A, 12-B …); choose under Numbering and click Renumber desks to apply it to all desks.',
            'Select several things with Shift-click or Shift-drag, then copy (⌘C / Ctrl+C) and paste (⌘V / Ctrl+V), even onto another floor. Undo with ⌘Z / Ctrl+Z. Press ? for all shortcuts.',
          ],
        },
      ],
      tips: [
        'Drag on empty floor to move around; scroll or pinch to zoom.',
        'Desks that ever had someone can’t be deleted (their history must stay) — block them instead.',
        'Edit layout works on tablets and phones too: the details open in a panel below the floor.',
      ],
    },
    seating: {
      title: 'Giving people their desks',
      summary: 'Assign, move, reserve and free desks — and see who sits where.',
      steps: [
        {
          title: 'Click a desk',
          text: [
            'Green desks are free, grey ones taken, yellow ones reserved. Click a desk to see who sits there, since when, and everyone who sat there before.',
          ],
          image: 'map-seat',
        },
        {
          title: 'Assign or move someone',
          text: [
            'Click a free (green) desk and choose Assign person, then pick the person. Or drag a name from the list on the left onto the desk. If they already sit somewhere, that is a move: their old desk becomes free.',
            'Every change shows a message with Undo. The history keeps both the change and the undo.',
          ],
        },
        {
          title: 'Reserve or free a desk',
          text: [
            'Click a free desk, choose Reserve and type who it is for (e.g. “New hire in May”). To end a seat, click it and choose Free seat or Cancel reservation.',
          ],
        },
        {
          title: 'Book a shared desk for a day',
          text: [
            'An editor or admin makes a desk shared: Edit layout, click the desk, turn on Shared desk. Shared desks have a dotted inner line on the map and nobody sits there for good.',
            'Above the map, pick the day (today, tomorrow … up to 4 weeks ahead). Click a green shared desk and choose Book. Everyone can book for themselves, viewers too; one desk per person per day. Your bookings also show on Home under My seat.',
            'To give the desk back, click it and choose Cancel my booking. Editors and admins can book for someone else and cancel any booking.',
          ],
        },
        {
          title: 'Find a person or a free desk',
          text: [
            'Type a name in the people search on the left and click the person: you see their desk and history. Find a free desk filters free desks by what they have — standing desk, two screens, by the window.',
            'Colour seats by: Team shows each team’s area in its own colour.',
          ],
        },
      ],
      tips: [
        'Viewers see everything and can book shared desks, but can’t change seats; ask an editor or admin.',
        'People can get an e-mail about their new desk (People & access → Settings → Notices).',
      ],
    },
    people: {
      title: 'People and access',
      summary:
        'Add your colleagues by hand, from Excel or from Microsoft 365, and decide who may do what.',
      steps: [
        {
          title: 'Open People & access',
          text: [
            'Admins find everyone under People & access: team, desk, role and whether they still work here. Filter by people without a desk, people leaving soon or people who left.',
          ],
          image: 'people',
        },
        {
          title: 'Add a person',
          text: [
            'Click Add person, enter name and e-mail, optionally a team and a role. Leave “E-mail them a sign-in invitation” on to let them sign in right away.',
          ],
          image: 'people-add',
        },
        {
          title: 'Import a list from Excel',
          text: [
            'Click Import list and choose an Excel or CSV file with name and e-mail (and team or job title if you have them). Column titles can be in English, German or French. Seatline shows which rows are new before anything is saved.',
          ],
          image: 'people-import',
        },
        {
          title: 'Microsoft 365 and roles',
          text: [
            'With Microsoft 365, people and teams update every night from your directory (Settings → Sync now for an immediate update). Your IT approves Seatline once.',
            'Roles: Viewer sees the map, Editor changes seats and layouts, Admin also manages people and settings. “No access” people can still have a desk.',
          ],
        },
      ],
    },
    'microsoft-365': {
      title: 'Microsoft 365: approval for IT',
      summary:
        'For IT admins: what Seatline asks Microsoft 365 for, how to approve it once, and how to limit or remove it.',
      steps: [
        {
          title: 'What Seatline asks for',
          text: [
            'Sign-in: colleagues sign in with their Microsoft 365 work account. Seatline gets their name, e-mail address and Microsoft’s ID for them (permissions openid, profile, email and User.Read).',
            'People list, for the nightly update: the application permission User.Read.All (“Read all users’ full profiles”). Of that, Seatline keeps only name, e-mail, department, job title and whether the account is active. Guest accounts are skipped.',
            'Seatline never writes anything to Microsoft 365, and it doesn’t read mail, calendars, files or Teams.',
          ],
        },
        {
          title: 'Who gets in',
          text: [
            'The first person from your organisation who signs in creates the workspace and becomes its admin. Everyone else from the same organisation joins that workspace when they sign in — there is never a second workspace for your organisation.',
            'An admin decides what newcomers get under People & access → Settings → Who can open Seatline: “Everyone in the organisation can view the map” (they start as Viewer) or “Only people you give a role”.',
          ],
        },
        {
          title: 'Approve Seatline once',
          text: [
            'The people list always needs an admin’s approval. In Seatline, an admin opens People & access → Settings → Microsoft 365 and clicks Sync now. If Microsoft hasn’t approved it yet, the button Approve in Microsoft appears: a Global Administrator or Privileged Role Administrator clicks it and accepts.',
            'If your organisation doesn’t let people approve apps themselves, the first person already sees “Need admin approval” when signing in. Then IT opens the approval link below and accepts — that covers sign-in and the people list together.',
          ],
          approvalLink: 'Approval link for IT:',
        },
        {
          title: 'Limit Seatline to some people (optional)',
          text: [
            'In the Microsoft Entra admin center, open Enterprise applications → Seatline → Properties, set “Assignment required?” to Yes and save. Then add the people or groups who may sign in under Users and groups.',
            'This limits who can sign in. The nightly people list still comes from the whole directory, so everyone can get a desk.',
          ],
        },
        {
          title: 'Remove the approval',
          text: [
            'In the Microsoft Entra admin center, Enterprise applications → Seatline → Properties → Delete removes Seatline from your organisation. New sign-ins and the nightly update stop at once; someone who is already signed in stays signed in for up to 30 days.',
            'Your data in Seatline stays until your workspace is deleted. To delete it, write to hello@seatline.ch.',
          ],
        },
      ],
      tips: [
        'Everyone signs in through Microsoft, so your MFA and Conditional Access rules apply as usual.',
        'People removed or disabled in Microsoft 365 lose access and their desk the next night; their seat history stays.',
        'Your data stays in Switzerland (Microsoft Azure, Zurich). The data processing agreement is at seatline.ch/legal/dpa.',
      ],
    },
    'teams-and-changes': {
      title: 'Teams, HR changes and notices',
      summary: 'Keep teams up to date, handle joiners and leavers, and let IT know automatically.',
      steps: [
        {
          title: 'Teams',
          text: [
            'The Teams tab shows each team with how many people are seated and on which floors. Rename or remove a team there, or add people to it. Teams come from the department in Microsoft 365; a team set by hand stays.',
          ],
          image: 'teams',
        },
        {
          title: 'Several changes at once',
          text: [
            'In the Changes tab, change team, role and leaving date for many people, then Save changes — all together or nothing.',
            'On the leaving day, early in the morning, the person is marked as left and their desk becomes free. Their seat history stays.',
          ],
          image: 'changes',
        },
        {
          title: 'Notices to IT or facility management',
          text: [
            'In Settings → Notices, add the addresses that should hear about changes (e.g. it@company.ch) and choose what: someone leaves, joins, changes team, or a move plan is carried out. One short plain e-mail per change.',
          ],
          image: 'settings',
        },
      ],
    },
    moves: {
      title: 'Planning moves',
      summary: 'Prepare a team move, check it on the map and let it happen on the day you choose.',
      steps: [
        {
          title: 'Create a move plan',
          text: [
            'Open Moves and click New move plan. Give it a name (e.g. “Sales to the 2nd floor”). Nothing changes on the real map until the plan is applied.',
          ],
          image: 'moves',
        },
        {
          title: 'Plan on the map',
          text: [
            'Click Plan on the map. The map shows the floor as it will be: drag people onto desks as usual — each move is added to the plan. Move a team places a whole team at once.',
          ],
          image: 'move-map',
        },
        {
          title: 'Check and schedule',
          text: [
            'The plan page lists every move and warns about problems (a desk taken by someone who isn’t moving, a blocked desk, a desk wanted twice). Choose Schedule for a date — the moves happen early that morning — or Apply now.',
          ],
          image: 'move-plan',
        },
        {
          title: 'Moving list for the movers',
          text: [
            'Moving list prints every move sorted by starting place, with a tick box per move and signature lines.',
          ],
        },
      ],
      tips: ['A scheduled plan is locked; choose Back to draft to change it.'],
    },
    'home-planning-activity': {
      title: 'Home, planning and activity',
      summary: 'Your dashboard, space planning for growing teams, and the full change log.',
      steps: [
        {
          title: 'Arrange Home',
          text: [
            'Click Customize to add, move, resize or remove widgets: free desks per floor, people without a desk, reservations, weekly trend and more. Admins can save their layout as the company default.',
          ],
          image: 'home',
        },
        {
          title: 'Space planning',
          text: [
            'Under Planning, enter how many people each team expects and by when. Seatline compares it with the free desks and shows how many desks will be missing.',
          ],
          image: 'planning',
        },
        {
          title: 'Activity: who changed what',
          text: [
            'Activity lists every change in plain words, newest first. Search for a person, desk or room, or filter by kind of change.',
          ],
          image: 'activity',
        },
      ],
    },
    'exports-and-qr': {
      title: 'Exports, printing and QR codes',
      summary: 'Seating lists for Excel, printed floor plans and QR stickers for every desk.',
      steps: [
        {
          title: 'Export menu',
          text: [
            'Export (on Home and on the map) gives you the seating list as Excel or CSV, the seat history, a printable floor plan (save it as PDF) and desk QR codes.',
          ],
          image: 'export-menu',
        },
        {
          title: 'QR stickers for desks',
          text: [
            'Desk QR codes prints 12 stickers per A4 sheet, never cut between pages. Stick one on each desk.',
          ],
          image: 'qr',
        },
        {
          title: 'What a sticker opens',
          text: [
            'Scanning a sticker with a phone opens that desk’s page: who sits there, their team and e-mail, what the desk has and its history. Only colleagues signed in to your workspace see it.',
          ],
          image: 'desk-phone',
        },
      ],
    },
    'privacy-and-billing': {
      title: 'Data protection, DPA and billing',
      summary:
        'How long history is kept, requests from employees, the data processing agreement and your subscription.',
      steps: [
        {
          title: 'How long history is kept',
          text: [
            'Under People & access → Settings → Data protection, choose how long seat history and activity are kept (1, 2, 5 or 10 years). Older history is deleted every night and people who left are anonymised.',
          ],
          image: 'privacy',
        },
        {
          title: 'Requests from employees',
          text: [
            'Next to each person, ⋯ → Download their data gives everything Seatline stores about them. Forget this person removes the personal data of someone who left; their seat history stays as “Former employee”.',
          ],
        },
        {
          title: 'Data processing agreement (DPA)',
          text: [
            'The DPA is part of the terms and already applies to your workspace. Click E-mail me the DPA (PDF) to get a copy with your company’s name for your records.',
          ],
        },
        {
          title: 'Subscription',
          text: [
            'The first 30 days are free. Admins subscribe under Billing (CHF 2 per active desk per month, CHF 0.99 from the 51st desk); the remaining trial days stay free. Without a subscription the workspace becomes read-only after the trial — nothing is deleted.',
          ],
        },
      ],
    },
  },
  faq: [
    {
      q: 'I didn’t get the sign-in e-mail.',
      a: 'Check your spam or junk folder and wait a minute. The link works once and for 15 minutes; ask for a new one if it expired. If your company uses Microsoft 365, sign in with Microsoft instead.',
    },
    {
      q: 'Seatline on my phone’s home screen keeps asking me to sign in.',
      a: 'An app on the home screen keeps its own sign-in, and the link in the e-mail always opens in your browser. So in the app, ask for a link as usual, then type the code from that e-mail on “Check your inbox”. The app then stays signed in for 30 days.',
    },
    {
      q: 'Why can’t I change anything?',
      a: 'Either your role is Viewer (ask an admin to make you an editor), or the workspace is read-only because the trial ended without a subscription — an admin can subscribe under Billing.',
    },
    {
      q: 'How do I give someone a desk?',
      a: 'On the map, click a free (green) desk and choose Assign person. Or drag the person from the list on the left onto the desk.',
    },
    {
      q: 'Someone moves to another desk — do I free the old one first?',
      a: 'No. Drag them to the new desk; their old desk becomes free automatically and both are kept in the history.',
    },
    {
      q: 'I made a mistake. Can I undo it?',
      a: 'Yes. Every seat change shows a message with Undo, and in Edit layout ⌘Z / Ctrl+Z undoes your last steps.',
    },
    {
      q: 'Can I delete a desk?',
      a: 'Only if nobody ever sat there. Desks with history can’t be deleted (the history must stay) — block them instead in Edit layout.',
    },
    {
      q: 'How do I import our people from Excel?',
      a: 'People & access → Import list. A file with a name and e-mail column is enough; Seatline shows what it found before saving.',
    },
    {
      q: 'Someone leaves the company. What do I do?',
      a: 'Set their leaving date in the Changes tab (or ⋯ → Mark as left). On that day their desk becomes free automatically and IT gets a notice if you set one up. With Microsoft 365 this happens by itself when they are removed there.',
    },
    {
      q: 'What do the colours on the map mean?',
      a: 'Green: free. Grey: taken. Yellow: reserved. Crossed out: blocked. With “Colour seats by: Team”, colours show teams instead.',
    },
    {
      q: 'Who can see the map?',
      a: 'Everyone in your workspace with a role (Viewer, Editor or Admin). Nobody outside your workspace, and a desk’s QR code only opens for signed-in colleagues.',
    },
    {
      q: 'Can people use Seatline on their phone?',
      a: 'Yes, in the browser — no app to install. The map, people search, desk pages and even Edit layout work on phones and tablets.',
    },
    {
      q: 'Where is our data stored?',
      a: 'In Switzerland, in Microsoft Azure (Zurich), including backups. Seatline follows the Swiss nDSG and the GDPR.',
    },
    {
      q: 'How do I get a copy of the data processing agreement?',
      a: 'People & access → Settings → Data protection → E-mail me the DPA (PDF).',
    },
    {
      q: 'How much does Seatline cost?',
      a: 'CHF 2 per active desk per month, and CHF 0.99 for every desk from the 51st. Blocked desks are free, the first 30 days too, and you can cancel any month.',
    },
    {
      q: 'What happens after the trial?',
      a: 'An admin subscribes under Billing. If nobody does, the workspace becomes read-only: everything stays visible and nothing is deleted.',
    },
    {
      q: 'Our architect’s plan is a DWG file.',
      a: 'Save it as DXF or PDF in the CAD program (or ask the architect), then use Add plan → Import architect plan.',
    },
    {
      q: 'Can we move a whole team at once?',
      a: 'Yes: create a move plan, open it on the map and use Move a team. Schedule it for a date and the moves happen early that morning.',
    },
    {
      q: 'I need help that isn’t here.',
      a: 'Write to hello@seatline.ch.',
    },
  ],
};
