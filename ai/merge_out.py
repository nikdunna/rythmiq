midi = pretty_midi.PrettyMIDI("gen path")

out = pretty_midi.PrettyMIDI()
out.instruments = [inst for inst in midi.instruments].extend([inst for inst in pretty_midi.PrettyMIDI("input path").instruments if inst.program in [*range(25, 32), *range(40, 49)]])
out.write("out path")