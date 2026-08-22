#ifndef STATE_H
#define STATE_H

enum class BMOState
{
    IDLE,
    RECORDING,
    THINKING,
    SPEAKING,
    ERROR_STATE
};

extern BMOState currentState;

void setState(BMOState state);
BMOState getState();

void bmo_state_machine_init();

#endif