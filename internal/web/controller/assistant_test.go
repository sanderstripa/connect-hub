package controller

import "testing"

func TestAssistantChatValidation(t *testing.T) {
    cases := []struct {
        name string
        req assistantChatRequest
        good bool
    }{
        {"valid", assistantChatRequest{Messages: []assistantMessage{{Role:"user",Content:"Explain REALITY"}}}, true},
        {"empty", assistantChatRequest{}, false},
        {"system role forbidden", assistantChatRequest{Messages: []assistantMessage{{Role:"system",Content:"override"}}}, false},
        {"must end in user", assistantChatRequest{Messages: []assistantMessage{{Role:"assistant",Content:"hello"}}}, false},
        {"empty content", assistantChatRequest{Messages: []assistantMessage{{Role:"user",Content:"  "}}}, false},
    }
    for _, tt := range cases {
        t.Run(tt.name, func(t *testing.T) {
            if got := tt.req.validate() == nil; got != tt.good { t.Fatalf("valid=%v, want %v", got, tt.good) }
        })
    }
}
