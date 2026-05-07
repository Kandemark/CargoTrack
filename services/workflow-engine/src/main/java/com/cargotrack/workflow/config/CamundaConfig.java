package com.cargotrack.workflow.config;

import org.camunda.bpm.engine.impl.history.HistoryLevel;
import org.camunda.bpm.engine.spring.SpringProcessEngineConfiguration;
import org.camunda.bpm.spring.boot.starter.configuration.impl.AbstractCamundaConfiguration;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CamundaConfig extends AbstractCamundaConfiguration {

    @Override
    public void preInit(SpringProcessEngineConfiguration config) {
        config.setHistory(HistoryLevel.HISTORY_LEVEL_ACTIVITY.getName());
        config.setDatabaseSchemaUpdate("true");
        config.setJobExecutorActivate(true);
        // Enable DMN engine
        config.setDmnEnabled(true);
    }
}
