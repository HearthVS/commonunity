import { useEffect } from "react";
import { setNexusContext } from "../components/NexusPanel";

export default function Sources() {
  const sources = [
    {
      category: "Planetary Frequencies",
      items: [
        {
          id: "cousto-1988",
          title: "The Cosmic Octave: Origin of Harmony",
          author: "Hans Cousto",
          year: "1988 (German), 2000 (English translation)",
          publisher: "LifeRhythm / Binkey Kok",
          description:
            "The foundational work establishing planetary frequency correspondences via octave transposition. All Planetware (PW) fork frequencies in this application derive from Cousto's calculations: Earth Day (194.18 Hz), Synodic Moon (210.42 Hz), Sun Tone (126.22 Hz), Earth Year / OM (136.10 Hz), Mercury (141.27 Hz), Venus (221.23 Hz), Mars (144.72 Hz), Platonic Year (172.06 Hz).",
          license: "CC BY-NC-ND 4.0 (Planetware digital reproductions)",
        },
        {
          id: "planetware-2009",
          title: "Cosmic Octave Tuning Forks — Product Documentation",
          author: "Planetware GmbH",
          year: "2009–present",
          publisher: "Planetware / MusiMed",
          description:
            "Manufacturer reference cards for the Chakra L Weighted Set, Otto forks, and OM forks. Instrument IDs TF-PW-*, TF-OTTO-*, TF-OM-136W correspond to instruments in this product family.",
          license: "Manufacturer documentation — educational use",
        },
      ],
    },
    {
      category: "Solfeggio Frequencies",
      items: [
        {
          id: "puleo-1999",
          title: "Healing Codes for the Biological Apocalypse",
          author: "Leonard Horowitz & Joseph Puleo",
          year: "1999",
          publisher: "Tetrahedron Publishing",
          description:
            "Documented the claimed rediscovery of the ancient Solfeggio scale: 174, 285, 396, 417, 528, 639, 741, 852, 963 Hz. The '528 Hz DNA repair' frequency appears in this work. This application lists Solfeggio frequencies with attribution but does not endorse specific healing claims.",
          license: "Referenced — not licensed",
        },
      ],
    },
    {
      category: "Sound Healing Practice",
      items: [
        {
          id: "goldman-2002",
          title: "Healing Sounds: The Power of Harmonics",
          author: "Jonathan Goldman",
          year: "2002 (revised)",
          publisher: "Healing Arts Press",
          description:
            "Foundational practitioner reference for overtone healing, intention, and sound therapy principles. The 'Intention + Frequency = Healing' framework referenced in protocol design.",
          license: "Referenced — not licensed",
        },
        {
          id: "beaulieu-2010",
          title: "Human Tuning: Sound Healing with Tuning Forks",
          author: "John Beaulieu",
          year: "2010",
          publisher: "BioSonic Enterprises",
          description:
            "John Beaulieu's practitioner guide for BioSonic tuning fork therapy. The BioSonic (BS) instrument series (TF-BS-C256, TF-BS-G384) in this application are from the BioSonic product family.",
          license: "Referenced — not licensed",
        },
        {
          id: "acutonics-2002",
          title: "Acutonics: There's No Place Like Ohm",
          author: "Donna Carey, Marjorie de Muynck & Ellen Franklin",
          year: "2002",
          publisher: "Devachan Press",
          description:
            "Defines the Acutonics tuning fork system combining planetary frequencies with acupuncture meridian theory. The TF-AC-* instrument series in this application references Acutonics Planet Ohm frequencies.",
          license: "Referenced — not licensed",
        },
      ],
    },
    {
      category: "Āyurveda",
      items: [
        {
          id: "lad-2002",
          title: "The Complete Book of Ayurvedic Home Remedies",
          author: "Vasant Lad",
          year: "2002",
          publisher: "Three Rivers Press",
          description:
            "Reference for dosha theory (Vāta, Pitta, Kapha), constitutional assessment, and Pañcamahābhūta (five elements). The Āyurveda Atlas in this application is informed by Lad's foundational framework.",
          license: "Referenced — not licensed",
        },
      ],
    },
    {
      category: "Gurdjieff / Centers",
      items: [
        {
          id: "ouspensky-1949",
          title: "In Search of the Miraculous",
          author: "P.D. Ouspensky",
          year: "1949",
          publisher: "Harcourt, Brace and Company",
          description:
            "Records G.I. Gurdjieff's oral teachings including the centers model (physical, emotional, intellectual, instinctive, sex). The Centers Atlas in this application is based on this framework. The sound healing application layer is a CommonUnity synthesis — not a direct Fourth Way teaching.",
          license: "Public domain (pre-1978 US publication)",
        },
      ],
    },
    {
      category: "Yoga & Chakra Philosophy",
      items: [
        {
          id: "johari-1987",
          title: "Chakras: Energy Centers of Transformation",
          author: "Harish Johari",
          year: "1987",
          publisher: "Destiny Books",
          description:
            "Authoritative source for chakra colours, bija mantras, element correspondences, and yantra geometry. Chakra colour assignments (Root: red, Sacral: orange, Solar: yellow, Heart: green, Throat: blue, Third Eye: indigo, Crown: violet) in this application follow Johari's classical system.",
          license: "Referenced — not licensed",
        },
        {
          id: "patanjali",
          title: "Yoga Sutras of Patañjali",
          author: "Patañjali",
          year: "c. 400 CE",
          publisher: "Multiple translations available",
          description:
            "Foundational text of classical yoga philosophy. The eight-limbed path (ashtanga) informs the philosophical context for sound healing as a complementary limb of pratyahara (withdrawal of senses) and dharana (concentration).",
          license: "Public domain",
        },
      ],
    },
    {
      category: "Chladni Patterns",
      items: [
        {
          id: "chladni-1787",
          title: "Entdeckungen über die Theorie des Klanges (Discoveries on the Theory of Sound)",
          author: "Ernst Florens Friedrich Chladni",
          year: "1787",
          publisher: "Weidmanns Erben und Reich",
          description:
            "Original publication documenting the vibrating plate patterns now called Chladni figures. The visualisation in this application uses the classical partial differential equation for a square vibrating plate to approximate Chladni figures for given frequencies.",
          license: "Public domain",
        },
      ],
    },
  ];

  useEffect(() => {
    setNexusContext("Sources & Licensing\nAttributions for McKusick Biofield Tuning, Cousto Cosmic Octave, Solfeggio lineage, and instrument manufacturers.");
    return () => setNexusContext("Frequency toolkit — OM Tuner");
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-white">Source Library</h1>
        <p className="text-sm text-muted-foreground">
          OM Tuner honours multiple healing lineages by citing all sources transparently.
          Frequency assignments that differ between systems (Cousto vs. Solfeggio vs. Western tonal)
          are displayed with full attribution rather than resolved to a single "correct" value.
        </p>
      </div>

      {/* Attribution statement */}
      <div className="bg-card border border-white/10 rounded-xl p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          This application does not make medical claims. All frequency–chakra correspondences, dosha
          assessments, and protocol recommendations are educational wellness tools drawn from traditional
          systems. They are not substitutes for medical diagnosis or treatment. Sources are cited for
          transparency; citation does not imply endorsement of all claims made in cited works.
        </p>
      </div>

      {/* Source sections */}
      {sources.map((section) => (
        <div key={section.category} className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{section.category}</h2>
          <div className="space-y-4">
            {section.items.map((src) => (
              <div
                key={src.id}
                className="bg-card border border-white/10 rounded-xl p-5 space-y-3"
                data-testid={`source-${src.id}`}
              >
                <div>
                  <h3 className="font-semibold text-white text-sm leading-snug">{src.title}</h3>
                  <p className="text-xs text-primary mt-0.5">{src.author} · {src.year}</p>
                  <p className="text-xs text-muted-foreground">{src.publisher}</p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{src.description}</p>
                <div className="inline-block bg-white/5 px-2.5 py-1 rounded text-xs text-muted-foreground">
                  {src.license}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
