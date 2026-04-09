"""tracking/forms.py — Django ModelForm for logging tracking events."""
from django import forms
from .models import TrackingEvent


class TrackingEventForm(forms.ModelForm):
    class Meta:
        model = TrackingEvent
        fields = ['event_type', 'location', 'notes']
        widgets = {
            'event_type': forms.Select(attrs={'class': 'form-select'}),
            'location':   forms.TextInput(attrs={
                'class': 'form-control', 'placeholder': 'e.g. Mombasa Port Gate 3',
            }),
            'notes': forms.Textarea(attrs={
                'class': 'form-control', 'rows': 3,
                'placeholder': 'Optional notes about this event',
            }),
        }
