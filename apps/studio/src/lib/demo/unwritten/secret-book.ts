/**
 * Démonstration UNWRITTEN — collection « The Secret Book » (anglais, A5).
 * Texte rédigé à la main pour la démonstration du moteur éditorial ; aucune génération IA.
 * Personnalisation fictive : Maya (destinataire), Grandpa Tom (offrant), Ashcombe Lane, Biscuit.
 */
import type { ManuscriptInput } from "@/lib/editorial/manuscript";

export const SECRET_BOOK_DEMO: ManuscriptInput = {
  collection: "secret-book",
  lang: "en",
  title: "The Lighthouse Keeper's Secret",
  subtitle: "A book that opens only once",
  recipient: "Maya",
  author: "by Grandpa Tom",
  dedication: { text: "For Maya, who counts the swallows,\nand for the seventh step, which kept our secret for forty years.", signature: "Grandpa Tom" },
  epigraph: { text: "Some doors are only locked so that someone, one day, will have the pleasure of opening them.", source: "Written on the inside of the attic door" },
  cover: { direction: "secret-seal", monogram: "M" },
  edition: { number: "0001", note: "This copy belongs to Maya. If you found it, please return it to the house with the blue door on Ashcombe Lane." },
  personalization: ["Maya", "Grandpa Tom", "Ashcombe Lane", "Biscuit"],
  chapters: [
    {
      title: "The Seventh Step",
      blocks: [
        "The house at the end of Ashcombe Lane had a blue door, and behind the blue door there was a staircase that creaked on the seventh step. Always the seventh, never the sixth, never the eighth, as if the wood remembered something the rest of the house had chosen to forget.",
        "Maya knew this because she had counted. She counted everything that summer: the swallows on the telephone wire, the seconds between the flashes of the lighthouse, the number of times her grandfather said \"we'll see\" when what he really meant was yes. Counting was a way of keeping the world in order while everything else was being packed into boxes.",
        "Her parents were moving to the city in September. The house on Ashcombe Lane was not being sold, not yet, but the word had been spoken at dinner, quietly, the way grown-ups say words they hope children will not catch. Maya had caught it. She had folded it up and put it in her pocket with the other things she was not supposed to know.",
        "So when Grandpa Tom asked her, on the first morning of the holidays, whether she had ever wondered why the seventh step creaked, she did not answer straight away. She looked at him over her bowl of cereal, and he looked back at her over his newspaper, and Biscuit, who was under the table hoping for toast, looked at both of them.",
        "\"I thought it was just old,\" she said at last.",
        "\"Everything in this house is old,\" said Grandpa Tom. \"Including me. But only one step talks.\"",
        { type: "break" },
        "That afternoon, while the rain made the garden smell of earth and pennies, Maya sat on the sixth step and pressed her ear against the seventh. It was not hollow, exactly. It sounded the way a shell sounds, as if it were holding a very small sea. She tapped it with her knuckle. She tapped the sixth and the eighth for comparison, like a doctor. The seventh answered with a different note, lower, rounder, a note that seemed to come from further away than the wood itself.",
        "She did not tell anyone. Not her mother, who was wrapping plates in newspaper in the kitchen. Not Biscuit, who could not be trusted with anything that smelled interesting. She wrote it down instead, in the back of her school diary, under a heading she underlined twice: *Things this house is hiding.*",
        "Under the heading, she wrote the number one. Then she wrote: *The seventh step.* Then she sat for a long time with the pencil against her lip, because she had the strangest feeling that the list was going to get longer.",
        { type: "activity", title: "Things this house is hiding", prompt: "Every house keeps a few secrets. Walk slowly through yours, with your ears as well as your eyes, and write down what you notice. A sound, a smell, a drawer that sticks, a door nobody opens.", kind: "checklist", items: ["A step, a floorboard or a door that makes a sound", "A place that smells different from the rest of the house", "Something old that nobody remembers buying"] },
      ],
    },
    {
      title: "A Map Drawn in Pencil",
      epigraph: { text: "Never trust a map that looks finished.", source: "Grandpa Tom" },
      blocks: [
        "The second clue arrived on a Tuesday, folded inside a library book that Grandpa Tom had borrowed in 1983 and never returned. Maya found it because she was looking for something to read that was not about horses, and because the book, a heavy green volume called *Lights and Lighthouses of the Southern Coast*, fell open on its own, the way books do when someone has read the same page many times.",
        "Between pages 112 and 113 there was a sheet of thin paper, the kind that crackles. On it, someone had drawn a map in pencil. Not a treasure map, with palm trees and a dotted line and an X, but a careful, patient drawing of the coastline below the house: the cove, the path through the gorse, the rocks the fishermen called the Sisters, and, at the very edge of the paper, the lighthouse on its little island, with a tiny window drawn halfway up the tower.",
        { type: "illustration", mode: "figure", caption: "The map from page 112, drawn in pencil on onion-skin paper" },
        "The window had been circled. Three times, in three different pencils, as if three different people, or one person on three different days, had wanted to be very sure.",
        "Maya took the map to the kitchen table and smoothed it flat with the side of her hand. She knew the cove and the path and the Sisters. She had walked them every summer of her life. But she had never been to the lighthouse, because the lighthouse could only be reached at the lowest tides of the year, across a causeway of wet stone that disappeared twice a day as though it had never been there at all.",
        "\"Grandpa,\" she said, when he came in from the garden with mud on his knees, \"who drew this?\"",
        "He took off his glasses, which was what he did when he wanted to see something properly, and held the paper up to the window. The light came through it and through the coastline and through the circled window, and for a moment Maya thought his face did something complicated, the way the sea does when a cloud passes over it.",
        "\"I did,\" he said. \"A long time ago. Before your mother was born.\"",
        "\"Why did you circle the window?\"",
        "He folded the map along its old creases, gently, and gave it back to her. \"Because,\" he said, \"that is where I left something for someone. And I think,\" he added, putting his glasses back on, \"that the someone might be you.\"",
        { type: "break" },
        "That night Maya could not sleep. She lay in the small bedroom under the roof, where the ceiling sloped so steeply that she could touch it without sitting up, and she watched the lighthouse beam sweep across the wall. One, two, three, four, five, six, seven. Darkness. One, two, three, four, five, six, seven. Light.",
        "Seven, she thought. Of course it was seven.",
        "She got out of bed, found her diary in the dark, and wrote, by the light of the lighthouse itself, the second line of her list: *The window that someone circled three times.*",
      ],
    },
    {
      title: "What the Lighthouse Knew",
      blocks: [
        "The lowest tide of the summer fell on the fourteenth of June, at twenty past six in the morning. Grandpa Tom knew this without looking it up, the way some people know their own telephone number. He woke Maya at five with a cup of hot chocolate and a pair of boots that had belonged to her mother when she was ten.",
        "They went down the path through the gorse while the sky was still the colour of the inside of a mussel shell. Biscuit came too, running ahead and running back, as if he wanted to make sure they were both still following. At the bottom of the cove the sea had gone so far out that it looked like a rumour. And there, where the water should have been, was the causeway: a long grey spine of stone, glistening, leading all the way to the island.",
        "\"We have one hour,\" said Grandpa Tom. \"Not a minute more. The sea is very polite, but it does not wait.\"",
        "They walked. The stones were slippery with weed and the pools on either side were full of small, startled lives: crabs that sidled away, anemones that closed like fists, a fish no longer than Maya's finger that hung perfectly still and then vanished. The lighthouse grew larger with every step, until it was not a picture any more but a building, white and enormous and peeling, with a door at the bottom that had once been painted blue.",
        { type: "citation", text: "The sea is very polite, but it does not wait.", source: "Grandpa Tom, on the causeway" },
        "The door was not locked. It had not been locked, Grandpa Tom said, since 1961, when the last keeper left and the light became automatic. Inside, a spiral staircase climbed into the dark. Maya counted the steps, because of course she did. On the hundred and twelfth, which was also the number of the page in the green library book, there was a small window. And under the window, in the thickness of the wall, there was a stone that did not quite match the others.",
        "Her grandfather did not help her. He stood two steps below, with his hand on the cold rail, and let her find it herself. She pressed the stone and it did not move. She pulled it and it did not move. Then she remembered the seventh step at home, and how it had answered her knuckle with a deeper note, and she tapped the stone instead, very lightly, three times.",
        "Something behind it shifted. A sound like a sigh. The stone came away in her hands, lighter than it looked, and behind it, wrapped in oilcloth and tied with a piece of fishing line, was a tin box the size of a book.",
        { type: "break" },
        "She did not open it there. Grandpa Tom said the sea would be coming back, and he was right: by the time they reached the bottom of the stairs, the causeway had begun to shine in a new way, wetter, thinner, as though it were already changing its mind. They walked back faster than they had come, Biscuit barking at the tide as if he could hold it off, and they reached the sand of the cove just as the first small wave folded itself over the stone behind them.",
        "Maya turned to look. The path they had walked was gone. There was only the sea, and the lighthouse standing in it, keeping its own counsel, exactly as it had for a hundred and fifty years.",
      ],
    },
    {
      title: "The Key Under the Blue Door",
      blocks: [
        "Inside the tin there were three things. A photograph of a girl about Maya's age, standing on the causeway in boots that were far too big for her. A key, small and dark, with a ribbon of faded red silk through its bow. And a letter, folded in four, with a single word written on the outside in her grandfather's handwriting, younger and rounder than it was now: *Later.*",
        "\"That's Mum,\" said Maya, holding the photograph to the light.",
        "\"That's your mother,\" Grandpa Tom agreed. \"The summer she was ten. I hid the box for her, the way my father hid one for me. She was supposed to find it the following year. But the following year we moved inland for my work, and then she grew up, and then it was always next summer, and next summer, and next summer.\" He smiled, and the smile was a little crooked. \"Things wait for us longer than we think. But not forever.\"",
        "\"And the key?\"",
        "\"The key opens the seventh step.\"",
        "It did. There was a keyhole there all along, hidden in the shadow of the riser, so small and so dark that Maya had taken it for a knot in the wood. The step lifted like the lid of a desk. Inside there was nothing but an empty space, dry and clean and smelling faintly of cedar, and a card on which someone had written, in pencil: *For the next secret.*",
        { type: "memory", title: "The day you found it", prompt: "Stick a photograph here of the place where you found this book, or draw it. Then write down the date, and who was with you, so that the next person to open it will know.", kind: "both", fields: ["Date", "With"] },
        "Maya understood then. The house was not hiding things to keep them from her. It was keeping them for her, the way a friend keeps a seat. And one day, she thought, when she was as old as her grandfather and the stairs creaked under somebody else's feet, she would put something in that space for someone she had not yet met.",
        "She did not know yet what it would be. That was the best part.",
        "That evening, while her mother read the letter marked *Later* at the kitchen table and cried a little and laughed a little and then went to find her father in the garden, Maya opened her diary and wrote the third and final line of her list. Then she crossed out the heading, *Things this house is hiding*, and wrote above it, in her neatest handwriting: *Things this house is keeping.*",
      ],
    },
  ],
  conclusion: {
    title: "For When You Are Older",
    blocks: [
      "Dear Maya, if you are reading this page, you have followed every clue, and you have done it the way I hoped you would: slowly, with your eyes and your ears, counting as you went.",
      "I wrote this book so that you would have something of the house on Ashcombe Lane that no removal van can carry. The step, the map, the lighthouse and the tin box are true. The rest is how I remember them, which is a kind of truth too.",
      "Keep the key somewhere safe. One day you will know exactly who it is for.",
    ],
    signature: "With all my love, Grandpa Tom",
  },
  backCover: {
    blurb: "One summer, on Ashcombe Lane, Maya discovers that the seventh step of her grandfather's staircase is hiding something.\nA pencil map, a lighthouse that can only be reached at the lowest tide of the year, and a tin box that has waited forty years for the right reader.",
    quote: "Things wait for us longer than we think. But not forever.",
  },
};
