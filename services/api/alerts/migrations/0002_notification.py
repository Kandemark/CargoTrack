from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('alerts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alert_type', models.CharField(max_length=50)),
                ('shipment_id', models.PositiveIntegerField()),
                ('tracking_number', models.CharField(max_length=20)),
                ('message', models.TextField()),
                ('severity', models.CharField(
                    choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')],
                    default='HIGH',
                    max_length=10,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('read', models.BooleanField(default=False)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['shipment_id'], name='alerts_noti_shipmen_idx'),
                    models.Index(fields=['read'], name='alerts_noti_read_idx'),
                ],
            },
        ),
    ]
