#ifndef STATE_H
#define STATE_H

enum class BMOState
{
    SLEEP,
    WAKE,
    LISTENING,
    THINKING,
    SPEAKING
};

extern BMOState currentState;

void setState(BMOState state);
BMOState getState();

void bmo_state_machine_init();

#endif