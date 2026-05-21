import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_add_logistics_roles'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='notification_prefs',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.CreateModel(
            name='APIKey',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name',       models.CharField(max_length=100)),
                ('prefix',     models.CharField(db_index=True, max_length=8)),
                ('hashed_key', models.CharField(max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_used',  models.DateTimeField(blank=True, null=True)),
                ('user',       models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='api_keys',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'API Key',
                'verbose_name_plural': 'API Keys',
                'ordering': ['-created_at'],
            },
        ),
    ]
