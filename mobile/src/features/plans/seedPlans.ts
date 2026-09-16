/**
 * Five starter reading plans, as data.
 *
 * PROVENANCE -- READ THIS BEFORE CHANGING ANYTHING HERE.
 * These are APP-CREATED GENERIC reading plans. They are NOT authored,
 * reviewed or endorsed by Bethaniya Ministries. An audit of the church's
 * online presence during the V1 tester-feedback pass found no official
 * devotional or reading-plan material to derive plans from: there is no
 * church website, and the similarly-named `bethaniya.com` is a different
 * organisation entirely (Bethania Retreat Centre, Thamarassery Diocese,
 * Kerala -- Malayalam, Syro-Malabar). The church's own logo reads
 * "Since 2026", consistent with having no established web presence yet.
 * See /PLANS_SOURCES.md for the full audit and per-plan sourcing.
 *
 * WHAT IS AND IS NOT SOURCED.
 *   - Scripture REFERENCES (book, chapter, verse ranges) are real and
 *     checkable; they are structural pointers, not text.
 *   - Plan titles, day titles, devotional paragraphs and prayer prompts
 *     are ORIGINAL APP-CREATED text, deliberately kept short, plain and
 *     doctrinally neutral so the church can replace them in its own
 *     voice.
 *   - NO scripture text is reproduced here. The app already renders
 *     verses from its own licensed datasets (see ../bible/) and the plan
 *     screens show only the reference.
 *
 * EDITABLE BY ADMINISTRATORS. These seed the `plans` / `plans/{id}/days`
 * Firestore collections the admin app already manages (see
 * admin/src/features/plans/ and ../../services/firebase/plans.ts). Once
 * seeded they are ordinary documents: a content_admin can edit the title,
 * description, devotional and prompt, reorder days, or delete a plan
 * outright. Nothing here is hardcoded into a screen.
 *
 * WHY IN THE MOBILE PACKAGE. The type definitions these must satisfy
 * (PublishedPlan / PublishedPlanDay) live in
 * ../../services/firebase/plans.ts, so keeping the data beside them means
 * the compiler checks every plan against the real model. The seeding
 * script imports from here -- see scripts/seed-plans.mjs.
 */
import type { PublishedPlan, PublishedPlanDay } from '../../services/firebase/plans';

/** A plan plus its ordered days, before either has a Firestore id. */
export interface SeedPlan {
  /** Stable slug used as the Firestore document id, so re-seeding is idempotent. */
  id: string;
  plan: Omit<PublishedPlan, 'id'>;
  days: Omit<PublishedPlanDay, 'id'>[];
}

/**
 * Marks every seeded plan in its description, so a member can see at a
 * glance that the church has not written it yet. The church removes this
 * sentence when it adopts or rewrites a plan.
 */
export const APP_CREATED_NOTICE =
  'A general Bible reading plan included with the app. Your church can edit or replace it.';

const psalms: SeedPlan = {
  id: 'seven-days-in-the-psalms',
  plan: {
    title: 'Seven Days in the Psalms',
    description: `One psalm a day for a week, chosen to move from trust through lament to praise. ${APP_CREATED_NOTICE}`,
    category: 'Devotional',
    coverImageUrl: null,
    dayCount: 7,
  },
  days: [
    {
      dayNumber: 1,
      title: 'Two Ways to Live',
      scriptureReference: 'Psalm 1',
      devotional:
        'The psalter opens with a choice, not a command: a life rooted by water, or one blown about like chaff. Notice what the rooted life is fed by, and how slowly a tree grows.',
      prayerPrompt: 'Ask for roots rather than quick fruit.',
    },
    {
      dayNumber: 2,
      title: 'The Shepherd',
      scriptureReference: 'Psalm 23',
      devotional:
        'Perhaps the most familiar psalm, and easy to read past. Read it slowly and count how many of its verbs belong to the shepherd rather than to the sheep.',
      prayerPrompt: 'Name one thing you are being asked to let be led.',
    },
    {
      dayNumber: 3,
      title: 'Out of the Depths',
      scriptureReference: 'Psalm 130',
      devotional:
        'A short psalm from the bottom of something. It does not rush to resolution; it waits, and says so twice. Lament belongs in prayer.',
      prayerPrompt: 'Say plainly what you are waiting for.',
    },
    {
      dayNumber: 4,
      title: 'Searched and Known',
      scriptureReference: 'Psalm 139:1-18',
      devotional:
        'Being fully known can feel like exposure or like safety, often both. This psalm holds the two together without choosing.',
      prayerPrompt: 'Offer one thing you would rather not be known for.',
    },
    {
      dayNumber: 5,
      title: 'Create in Me',
      scriptureReference: 'Psalm 51:1-17',
      devotional:
        'A prayer after failure. It asks not for the record to be cleared but for the heart to be remade, which is a harder and better request.',
      prayerPrompt: 'Ask for a changed heart, not only a clean record.',
    },
    {
      dayNumber: 6,
      title: 'A Refuge',
      scriptureReference: 'Psalm 46',
      devotional:
        'Written for a world that shakes. The stillness it commands in verse 10 is not calm weather; it is confidence in the middle of bad weather.',
      prayerPrompt: 'Be still for one minute before you speak.',
    },
    {
      dayNumber: 7,
      title: 'Let Everything Praise',
      scriptureReference: 'Psalm 150',
      devotional:
        'The psalter ends with instruments and breath. After a week that included lament, praise is not pretending; it is the last word rather than the only one.',
      prayerPrompt: 'Give thanks for one thing from this week.',
    },
  ],
};

const luke: SeedPlan = {
  id: 'the-life-of-christ-in-luke',
  plan: {
    title: 'The Life of Christ in Luke',
    description: `Fourteen days through Luke's Gospel, from the announcement of Jesus' birth to the road to Emmaus. ${APP_CREATED_NOTICE}`,
    category: 'Gospels',
    coverImageUrl: null,
    dayCount: 14,
  },
  days: [
    {
      dayNumber: 1,
      title: 'An Orderly Account',
      scriptureReference: 'Luke 1:1-25',
      devotional:
        'Luke begins like a historian, naming his method and his reader. The Gospel is offered as something you can check.',
      prayerPrompt: 'Ask for honest attention over the next two weeks.',
    },
    {
      dayNumber: 2,
      title: 'Let It Be',
      scriptureReference: 'Luke 1:26-56',
      devotional:
        'Mary asks a real question before she consents, and her song afterwards is political as well as personal: the powerful come down, the hungry are fed.',
      prayerPrompt: 'Ask your real question, then listen.',
    },
    {
      dayNumber: 3,
      title: 'Good News to Shepherds',
      scriptureReference: 'Luke 2:1-20',
      devotional:
        'The announcement goes first to night-shift workers on a hillside, not to the census-takers in the city. Luke keeps noticing who hears first.',
      prayerPrompt: 'Who around you hears good news last? Pray for them.',
    },
    {
      dayNumber: 4,
      title: 'Tested in the Wilderness',
      scriptureReference: 'Luke 4:1-13',
      devotional:
        'Each temptation offers a shortcut to something genuinely good. Refusing a shortcut is not the same as refusing the goal.',
      prayerPrompt: 'Name one shortcut you are tempted by.',
    },
    {
      dayNumber: 5,
      title: 'Rejected at Home',
      scriptureReference: 'Luke 4:14-30',
      devotional:
        'He reads Isaiah, says it is happening now, and the room turns. The offence is not the claim but who he says it includes.',
      prayerPrompt: 'Ask to be glad about mercy shown to outsiders.',
    },
    {
      dayNumber: 6,
      title: 'Called at Work',
      scriptureReference: 'Luke 5:1-11',
      devotional:
        'The call comes mid-shift, after a bad night and an absurd instruction. Peter argues, obeys, and then cannot cope with the result.',
      prayerPrompt: 'Offer the ordinary work of your week.',
    },
    {
      dayNumber: 7,
      title: 'Blessings and Warnings',
      scriptureReference: 'Luke 6:17-38',
      devotional:
        "Luke's version of the sermon pairs every blessing with a warning. Read both columns; they are addressed to the same crowd.",
      prayerPrompt: 'Ask where you are being warned, not only blessed.',
    },
    {
      dayNumber: 8,
      title: 'Much Forgiven',
      scriptureReference: 'Luke 7:36-50',
      devotional:
        'Two people are in the room with Jesus and only one of them knows they need anything. Love, here, is a symptom of forgiveness rather than its price.',
      prayerPrompt: 'Thank God for something specific you were forgiven.',
    },
    {
      dayNumber: 9,
      title: 'Who Is My Neighbour',
      scriptureReference: 'Luke 10:25-37',
      devotional:
        'The lawyer asks where the boundary of obligation lies. The story answers a different question: not who qualifies, but who acts.',
      prayerPrompt: 'Name one person whose need you have stepped around.',
    },
    {
      dayNumber: 10,
      title: 'Teach Us to Pray',
      scriptureReference: 'Luke 11:1-13',
      devotional:
        'The prayer he gives is short and mostly about bread, forgiveness and rescue. The parable after it is about persistence, not eloquence.',
      prayerPrompt: 'Pray the Lord’s Prayer slowly, once.',
    },
    {
      dayNumber: 11,
      title: 'Lost and Found',
      scriptureReference: 'Luke 15',
      devotional:
        'Three things are lost; three are found. The third story adds a son who never left and cannot celebrate, and it ends without telling us what he decided.',
      prayerPrompt: 'Which of the two sons are you today?',
    },
    {
      dayNumber: 12,
      title: 'The Last Supper',
      scriptureReference: 'Luke 22:14-30',
      devotional:
        'He hands them bread and a cup, and within minutes they are arguing about rank. He answers with a towel rather than a rebuke.',
      prayerPrompt: 'Ask for one way to serve without being noticed.',
    },
    {
      dayNumber: 13,
      title: 'The Crucifixion',
      scriptureReference: 'Luke 23:32-49',
      devotional:
        'Luke alone records the prayer for those doing it and the promise to the man beside him. Mercy is still working from the cross.',
      prayerPrompt: 'Sit with this for longer than is comfortable.',
    },
    {
      dayNumber: 14,
      title: 'The Road to Emmaus',
      scriptureReference: 'Luke 24:13-35',
      devotional:
        'Two people walk seven miles with the risen Christ and recognise him only when he breaks bread. Understanding arrives late, and that is allowed.',
      prayerPrompt: 'Look back for where he was walking with you unrecognised.',
    },
  ],
};

const romans: SeedPlan = {
  id: 'foundations-of-faith-in-romans',
  plan: {
    title: 'Foundations of Faith in Romans',
    description: `Ten days through Paul's longest letter, following its argument from the human condition to a life offered in response. ${APP_CREATED_NOTICE}`,
    category: 'Epistles',
    coverImageUrl: null,
    dayCount: 10,
  },
  days: [
    {
      dayNumber: 1,
      title: 'Not Ashamed',
      scriptureReference: 'Romans 1:1-17',
      devotional:
        'Paul states his thesis before his argument: the gospel is power, and it is for everyone, in that order.',
      prayerPrompt: 'Ask for confidence that is not defensiveness.',
    },
    {
      dayNumber: 2,
      title: 'No One Excepted',
      scriptureReference: 'Romans 3:9-26',
      devotional:
        'The levelling is total, and that is the point: if no one is excepted, no one is excluded from what comes next.',
      prayerPrompt: 'Drop one comparison you have been making.',
    },
    {
      dayNumber: 3,
      title: 'Counted as Righteous',
      scriptureReference: 'Romans 4:1-12',
      devotional:
        'Abraham is the test case. He was counted righteous before the law existed, which makes faith older than the rules.',
      prayerPrompt: 'Thank God for something you did not earn.',
    },
    {
      dayNumber: 4,
      title: 'Peace and Endurance',
      scriptureReference: 'Romans 5:1-11',
      devotional:
        'Suffering produces endurance, endurance character, character hope. Read the chain backwards and it explains a hard season.',
      prayerPrompt: 'Ask for endurance rather than escape.',
    },
    {
      dayNumber: 5,
      title: 'Newness of Life',
      scriptureReference: 'Romans 6:1-14',
      devotional:
        'If grace covers everything, why change? Paul answers with a funeral: you cannot go on living somewhere you have died to.',
      prayerPrompt: 'Name one habit you would like buried.',
    },
    {
      dayNumber: 6,
      title: 'The Divided Self',
      scriptureReference: 'Romans 7:14-25',
      devotional:
        'The most honest paragraph in the letter. Paul describes wanting the good and doing otherwise, and does not resolve it cheaply.',
      prayerPrompt: 'Be honest about one thing you keep repeating.',
    },
    {
      dayNumber: 7,
      title: 'No Condemnation',
      scriptureReference: 'Romans 8:1-17',
      devotional:
        'After chapter 7, this reads like air. The Spirit is described not as a force but as the one who makes you family.',
      prayerPrompt: 'Address God as Father, slowly.',
    },
    {
      dayNumber: 8,
      title: 'Nothing Can Separate',
      scriptureReference: 'Romans 8:28-39',
      devotional:
        'The list of things that cannot separate us is long and specific, which suggests Paul had tried most of them.',
      prayerPrompt: 'Add your own item to his list, then deny it power.',
    },
    {
      dayNumber: 9,
      title: 'A Living Sacrifice',
      scriptureReference: 'Romans 12:1-13',
      devotional:
        'The turn from argument to life. Worship here is a body, a week and a set of ordinary duties, not a service.',
      prayerPrompt: 'Offer tomorrow before it starts.',
    },
    {
      dayNumber: 10,
      title: 'Love Fulfils the Law',
      scriptureReference: 'Romans 13:8-14',
      devotional:
        'Every commandment is summarised in one debt that is never paid off. Paul ends where he began: this is for everyone.',
      prayerPrompt: 'Pay one instalment on that debt today.',
    },
  ],
};

const namesOfGod: SeedPlan = {
  id: 'names-of-god',
  plan: {
    title: 'Names of God',
    description: `Seven days on seven names Scripture gives God, and what each one claims. ${APP_CREATED_NOTICE}`,
    category: 'Topical',
    coverImageUrl: null,
    dayCount: 7,
  },
  days: [
    {
      dayNumber: 1,
      title: 'I Am Who I Am',
      scriptureReference: 'Exodus 3:1-15',
      devotional:
        'Moses asks for a name to carry back and is given a sentence instead. God is introduced as present rather than defined.',
      prayerPrompt: 'Ask simply for God to be present today.',
    },
    {
      dayNumber: 2,
      title: 'The Lord Will Provide',
      scriptureReference: 'Genesis 22:1-14',
      devotional:
        'A hard chapter. The name is given at the end, on the far side of the worst walk of Abraham’s life.',
      prayerPrompt: 'Name what you are afraid to trust God with.',
    },
    {
      dayNumber: 3,
      title: 'The Lord My Shepherd',
      scriptureReference: 'Psalm 23; John 10:11-18',
      devotional:
        'Read the psalm, then the claim Jesus makes on it. The shepherd who leads is also the one who dies for the flock.',
      prayerPrompt: 'Follow one instruction you have been avoiding.',
    },
    {
      dayNumber: 4,
      title: 'Prince of Peace',
      scriptureReference: 'Isaiah 9:2-7',
      devotional:
        'Four names in one verse, given to a people walking in darkness. Peace is promised as a government, not a mood.',
      prayerPrompt: 'Pray for peace somewhere it is absent.',
    },
    {
      dayNumber: 5,
      title: 'Immanuel',
      scriptureReference: 'Isaiah 7:14; Matthew 1:18-25',
      devotional:
        '"God with us" is the shortest summary of the whole story, and the hardest to believe on an ordinary Tuesday.',
      prayerPrompt: 'Say "God is with me" about one specific situation.',
    },
    {
      dayNumber: 6,
      title: 'The Bread of Life',
      scriptureReference: 'John 6:32-40',
      devotional:
        'The crowd wants another miracle meal. He offers himself instead, which is less convenient and more lasting.',
      prayerPrompt: 'Ask for what sustains rather than what satisfies.',
    },
    {
      dayNumber: 7,
      title: 'Alpha and Omega',
      scriptureReference: 'Revelation 21:1-7',
      devotional:
        'The last name in Scripture is a claim about both ends of everything, made to people who could not see how it would end.',
      prayerPrompt: 'Hand over one ending you cannot see.',
    },
  ],
};

const peace: SeedPlan = {
  id: 'peace-in-anxiety',
  plan: {
    title: 'Peace in Anxiety',
    description: `Five short days for a worried week. Brief readings, not a cure. ${APP_CREATED_NOTICE}`,
    category: 'Topical',
    coverImageUrl: null,
    dayCount: 5,
  },
  days: [
    {
      dayNumber: 1,
      title: 'Do Not Worry',
      scriptureReference: 'Matthew 6:25-34',
      devotional:
        'The argument is not that worry is wrong but that it is ineffective, and that tomorrow is already occupied.',
      prayerPrompt: 'Hand over tomorrow, only tomorrow.',
    },
    {
      dayNumber: 2,
      title: 'Cast Your Cares',
      scriptureReference: '1 Peter 5:6-11',
      devotional:
        'The instruction is active: throw it, do not carry it politely. The reason given is care, not duty.',
      prayerPrompt: 'Say one worry out loud, then stop holding it.',
    },
    {
      dayNumber: 3,
      title: 'In Everything, Prayer',
      scriptureReference: 'Philippians 4:4-9',
      devotional:
        'Paul writes this from prison, which matters. The peace promised is explicitly the kind that does not make sense.',
      prayerPrompt: 'Add thanksgiving to a request you keep repeating.',
    },
    {
      dayNumber: 4,
      title: 'When I Am Afraid',
      scriptureReference: 'Psalm 56',
      devotional:
        'Fear and trust appear in the same breath here, not in sequence. You do not have to stop being afraid first.',
      prayerPrompt: 'Pray while still afraid.',
    },
    {
      dayNumber: 5,
      title: 'Rest',
      scriptureReference: 'Matthew 11:28-30',
      devotional:
        'The offer is not the removal of the load but a different yoke and someone else pulling. Rest is learned, he says, from him.',
      prayerPrompt: 'Ask for rest rather than resolution.',
    },
  ],
};

/** Exactly five, in the order the church would most likely start with. */
export const SEED_PLANS: SeedPlan[] = [psalms, luke, romans, namesOfGod, peace];
