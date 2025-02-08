import numpy as np
from magenta.models.music_vae import TrainedModel as tm
from magenta.models.music_vae import configs
from note_seq import NoteSequence, midi_io


config = Config(
    model=MusicVAE(
        lstm_models.BidirectionalLstmEncoder(),
        lstm_models.HierarchicalLstmDecoder(
            lstm_models.SplitMultiOutLstmDecoder(
                core_decoders=[
                    #lstm_models.CategoricalLstmDecoder(),
                    lstm_models.CategoricalLstmDecoder(),
                    lstm_models.CategoricalLstmDecoder()],
                output_depths=[
                    #0,  # melody
                    90,  # bass
                    512,  # drums
                ]),
            level_lengths=[16, 16],
            disable_autoregression=True)),#try False
    hparams=merge_hparams(
        lstm_models.get_default_hparams(),
        HParams(
            batch_size=256,
            max_seq_len=2048,
            z_size=512,
            enc_rnn_size=[2048, 2048],
            dec_rnn_size=[1024, 1024],
            free_bits=256,
            max_beta=0.2,
        )),
    note_sequence_augmenter=None,
    data_converter=trio_16bar_converter,
    train_examples_path=None,
    eval_examples_path=None,
)

model = tm(config, batch_size=4, checkpoint_dir_or_path = 'CHECKPOINT__PATH')


num_outputs = 2
temperature= 0.6
generated_sequences = music_vae.sample(n=num_outputs, length = config.hparams.max_seq_len,temperature=temperature)


for i, ns in enumerate(generated_sequences):
    midi_filename = f'generated_sequence_{i}.mid'
    note_seq.sequence_proto_to_midi_file(ns, midi_filename)
    print(f'Saved: {midi_filename}')