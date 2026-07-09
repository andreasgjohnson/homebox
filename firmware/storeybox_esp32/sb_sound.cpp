#include "sb_sound.h"

#include "sb_config.h"

#if SB_ENABLE_SPEAKER
#include <ESP_I2S.h>
#include <math.h>

namespace {

I2SClass speakerI2S(I2S_NUM_1);
bool speakerReady = false;
constexpr uint32_t kSampleRate = 22050;
constexpr int16_t kAmplitude = 3600;

void writeTone(float frequency, uint16_t ms) {
  if (!speakerReady) {
    return;
  }

  uint32_t samples = (kSampleRate * ms) / 1000;
  for (uint32_t i = 0; i < samples; i++) {
    float phase = (TWO_PI * frequency * i) / kSampleRate;
    float envelope = 1.0f;
    if (i < 120) {
      envelope = i / 120.0f;
    } else if (samples > 120 && i > samples - 120) {
      envelope = (samples - i) / 120.0f;
    }
    int16_t sample = static_cast<int16_t>(sinf(phase) * kAmplitude * envelope);
    int16_t frame[2] = {sample, sample};
    speakerI2S.write(reinterpret_cast<const uint8_t *>(frame), sizeof(frame));
  }
}

void silence(uint16_t ms) {
  if (!speakerReady) {
    return;
  }
  int16_t frame[2] = {0, 0};
  uint32_t samples = (kSampleRate * ms) / 1000;
  for (uint32_t i = 0; i < samples; i++) {
    speakerI2S.write(reinterpret_cast<const uint8_t *>(frame), sizeof(frame));
  }
}

}  // namespace
#endif

void sbSoundBegin() {
#if SB_ENABLE_SPEAKER
  speakerI2S.setPins(SB_PIN_SPK_BCLK, SB_PIN_SPK_LRC, SB_PIN_SPK_DIN);
  speakerReady = speakerI2S.begin(I2S_MODE_STD, kSampleRate, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO);
  if (!speakerReady) {
    Serial.println("Speaker I2S disabled: init failed.");
  }
#endif
}

void sbSoundPlay(SbChime chime) {
#if SB_ENABLE_SPEAKER
  if (!speakerReady) {
    return;
  }

  switch (chime) {
    case SB_CHIME_START:
      writeTone(660.0f, 65);
      silence(18);
      writeTone(880.0f, 85);
      break;
    case SB_CHIME_STOP:
      writeTone(880.0f, 55);
      silence(16);
      writeTone(540.0f, 95);
      break;
    case SB_CHIME_PAIRED:
      writeTone(523.25f, 70);
      silence(18);
      writeTone(659.25f, 70);
      silence(18);
      writeTone(783.99f, 100);
      break;
    case SB_CHIME_ERROR:
      writeTone(196.0f, 140);
      silence(28);
      writeTone(155.56f, 180);
      break;
  }
#else
  (void)chime;
#endif
}
