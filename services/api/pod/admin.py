from django.contrib import admin

from .models import ProofOfDelivery, PODPhoto


class PODPhotoInline(admin.TabularInline):
    model = PODPhoto
    extra = 0
    fields = ('image', 'photo_type', 'caption', 'taken_at')


@admin.register(ProofOfDelivery)
class ProofOfDeliveryAdmin(admin.ModelAdmin):
    list_display = ('shipment', 'condition', 'received_by_name', 'delivered_at', 'captured_by')
    list_filter = ('condition', 'delivered_at')
    search_fields = ('shipment__tracking_number', 'received_by_name')
    inlines = [PODPhotoInline]


@admin.register(PODPhoto)
class PODPhotoAdmin(admin.ModelAdmin):
    list_display = ('pod', 'photo_type', 'taken_at')
    list_filter = ('photo_type',)
