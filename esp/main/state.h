#ifndef STATE_H
#define STATE_H

enum class JoyState
{
    IDLE,
    RECORDING,
    THINKING,
    SPEAKING,
    ERROR_STATE
};

extern JoyState currentState;

void setState(JoyState state);
bool trySetState(JoyState expected, JoyState next);
JoyState getState();

void joy_state_machine_init();

#endif
