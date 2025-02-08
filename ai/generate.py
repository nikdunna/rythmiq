import numpy as np
from magenta.models.music_vae import TrainedModel as tm
import configs
from note_seq import NoteSequence, midi_io


config = configs.CONFIG_MAP['hierdec-trio_16bar']

model = tm(config, batch_size=4, checkpoint_dir_or_path = 'CHECKPOINT__PATH')


num_outputs = 2
temperature= 0.6
generated_sequences = music_vae.sample(n=num_outputs, length = config.hparams.max_seq_len,temperature=temperature)


for i, ns in enumerate(generated_sequences):
    midi_filename = f'generated_sequence_{i}.mid'
    note_seq.sequence_proto_to_midi_file(ns, midi_filename)
    print(f'Saved: {midi_filename}')