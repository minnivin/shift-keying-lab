# Shift Keying Lab

An interactive web tool that compares four digital modulation schemes, **ASK, FSK, PSK and 16-QAM**, side by side: the waveform, the spectrum and bandwidth, and the bit errors caused by noise.

Built by **Saw Eaindray Thant** for the WCM555 Practice Tool Building Assignment (tool idea 2.1, the modulation visualizer with channel effects).

## Try it

Open the GitHub Pages link of this repository, or download `index.html` and open it in any web browser. Nothing to install.

## What it shows

- **Waveform + spectrum, together.** The bits and the four modulated carriers share one time axis, animated with a moving marker. The power spectrum of the chosen scheme is drawn below, with the others faint behind it, and updates at the same time.
- **I-Q constellation.** Next to the spectrum: the ideal symbols of the chosen scheme, labelled with their bits for 16-QAM, and the received symbols spread out by noise. Wrongly decoded symbols are red.
- **Channel effects.** A noise level (E<sub>b</sub>/N<sub>0</sub>, in dB) adds noise to the waveforms, a white-noise floor to the spectrum, and scatter to the constellation.
- **Bit errors.** BER against E<sub>b</sub>/N<sub>0</sub> for all four schemes: exact theory, plus a simulation that sends 200,000 random bits through noise and counts the errors.
- **Equations with your numbers.** A collapsible panel shows each formula filled in with the current settings.

## How to use it

1. Pick a scheme on the left (ASK, FSK, PSK or 16-QAM).
2. Type a bit pattern (up to 16 bits) or press Random, and set the bit rate.
3. Lower E<sub>b</sub>/N<sub>0</sub> (signal quality) to add noise, and tick "Show the noise" to see it on the waveforms, the spectrum and the constellation.
4. Under "More settings", change the carrier, the FSK tone spacing or the ASK modulation index.
5. Use the switch at the top of the plot to go between "Waveform + spectrum" and "Bit errors". In the Bit errors view, the starting settings are the Lecture 7 exercise (slide 9): BER 4×10⁻⁶ at 8 dB, where PSK needs 10 dB and FSK needs 13 dB.

## The maths

| Quantity | Formula |
|---|---|
| Bit time, symbol rate | T<sub>b</sub> = 1/R<sub>b</sub>, R<sub>s</sub> = R<sub>b</sub>/k (k = bits per symbol) |
| Bandwidth, ASK and PSK | BW<sub>NYQ</sub> = R<sub>b</sub>, BW<sub>NOM</sub> = 2R<sub>b</sub> |
| Bandwidth, FSK | BW<sub>NYQ</sub> = (f<sub>1</sub> − f<sub>0</sub>) + R<sub>b</sub>, BW<sub>NOM</sub> = (f<sub>1</sub> − f<sub>0</sub>) + 2R<sub>b</sub> |
| Bandwidth, 16-QAM | BW<sub>NYQ</sub> = R<sub>s</sub> = R<sub>b</sub>/4, BW<sub>NOM</sub> = 2R<sub>s</sub> |
| BER, PSK | Q(√(2E<sub>b</sub>/N<sub>0</sub>)) |
| BER, FSK | Q(√(E<sub>b</sub>/N<sub>0</sub>)) |
| BER, ASK (on-off) | Q(√(E<sub>b</sub>/(2N<sub>0</sub>))), or Q(√(2E<sub>b</sub>/N<sub>0</sub>)·m/(1+m)) with modulation index m |
| BER, 16-QAM | ≈ (3/4)·Q(√(0.8·E<sub>b</sub>/N<sub>0</sub>)); the tool uses the exact sum |
| Measured BER | bit errors / total bits |

Assumptions: white Gaussian noise, a coherent receiver, rectangular pulses, the same 1 V carrier amplitude for every scheme. PSK here is binary PSK (two phases, 0° and 180°). PSK, FSK and 16-QAM use the same average power. ASK is compared at the same peak amplitude, so on-off ASK uses half the average energy per bit. That is why it sits about 3 dB behind FSK, the same gap the Lecture 7 graph shows. At equal average energy it would match FSK.

## How it was checked

- The BER curves match the Lecture 7 slide 9 exercise and independent calculations of the Q function.
- The simulation agrees with the theory curves for all four schemes, and the constellation's symbol errors match theory.
- Waveform levels, noise power, spectrum power and the Gray coding of 16-QAM were checked numerically.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole tool in one file |
| `src/core.js` | The maths: waveforms, spectrum, BER formulas, simulation |
| `src/app.js` | Controls and plots (HTML canvas) |
| `src/body.html` | Page layout and styling |
| `src/build.py` | Joins the three source files into `index.html` (run `python build.py` inside `src`) |

Plain HTML, CSS and JavaScript, with no libraries.

## AI use

This tool was built by Saw Eaindray Thant for the WCM555 Practice Tool Building Assignment. The code was generated and refined from student-directed prompts using Claude. The bit-rate and bandwidth equations come from the course material. The BER formulas (the Q-function) come from standard AWGN detection theory, which is outside the course slides, since the lectures only show BER graphs. All content has been reviewed by the student for correctness.
