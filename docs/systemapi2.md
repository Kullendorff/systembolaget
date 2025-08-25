# Building AI Wine Tools for Systembolaget

**Systembolaget's official product API was discontinued in 2023**, but multiple technical pathways exist for building AI-powered wine selection tools through community APIs, MCP integration, and alternative approaches. However, Swedish alcohol regulations and compliance requirements significantly shape implementation options.

The Swedish alcohol monopoly removed their product data API in November 2023 after commercial violations of their terms of service, leaving only store location APIs available officially. This forces developers toward unofficial community solutions that carry legal uncertainty, while **Model Context Protocol (MCP) integration offers the most promising path for Claude Desktop users** seeking AI-powered wine recommendations.

## Current API landscape reveals limited official options

Systembolaget's API portal at `api-portal.systembolaget.se` now provides only **store and location data** through three endpoints: Site API v1, Agent API v2, and Store API v2. These APIs require free registration and API key authentication via the `Ocp-Apim-Subscription-Key` header, but contain no product information whatsoever.

The **official product API discontinuation stems from misuse by commercial entities** that violated Systembolaget's mission as an independent operator focused on responsible alcohol consumption rather than sales promotion. This policy change eliminated access to wine data, pricing, availability, and product details that would be essential for AI recommendation systems.

However, **three major community projects maintain unofficial product access**. The most reliable appears to be AlexGustafsson/systembolaget-api, a Go-based solution actively maintained through October 2024 that provides comprehensive product search and filtering capabilities. C4illin/systembolaget-data offers a Docker-based workaround serving approximately 73 MB of product data at `susbolaget.emrik.org/v1/products`. Meanwhile, dcronqvist/systembolaget-api remains under legal review with Systembolaget regarding terms of service compliance.

## MCP integration provides seamless Claude Desktop functionality

Model Context Protocol represents the most sophisticated approach for integrating Systembolaget data with AI assistants. **MCP acts as a "USB-C port for AI applications,"** creating standardized connections between Claude Desktop and external data sources through a client-server architecture using JSON-RPC 2.0 communication.

Building an MCP server for Systembolaget requires **TypeScript or Python development** using Anthropic's official SDK. The server configuration involves creating tool definitions for product search, availability checking, and wine recommendations that appear with slider/hammer icons in Claude Desktop. Users must approve each tool execution, providing security while enabling seamless wine selection assistance.

**Technical implementation follows this pattern**: Install the MCP SDK, create server tools for Systembolaget API calls, configure the server in Claude Desktop's `claude_desktop_config.json` file, and handle authentication through environment variables. The development workflow includes testing with MCP Inspector before deployment, with servers running as local processes or remote endpoints.

The **MCP ecosystem already includes e-commerce examples** like Shopify servers for product catalogs and Amazon integrations for purchase capabilities, demonstrating proven patterns for retail API integration that can be adapted for wine recommendations.

## Alternative approaches offer diverse implementation strategies

**Discord bot development provides excellent user engagement** through familiar chat interfaces with rich embed support for wine information display. Examples include WineHelper for conversational suggestions and various alcohol brand chatbots like Diageo's Simi with 2000+ cocktail recipes. Implementation complexity remains medium (3-4 weeks for MVP) using Discord.js libraries.

**Web scraping approaches require careful legal consideration** but offer real-time data access. Swedish law permits scraping when respecting robots.txt files, reasonable crawl delays, and GDPR compliance. Community implementations use both direct scraping and browser automation tools like Playwright or Puppeteer, though these methods carry higher legal risks and maintenance overhead.

**Third-party services provide professional-grade infrastructure** through platforms like Bright Data, ScraperAPI, or specialized wine recommendation services like Tastry's chemistry-based AI models. These solutions cost $50-500+ monthly but handle compliance and technical maintenance professionally.

**AI assistant integration through webhooks** enables connection with existing platforms like OpenAI GPTs, Zapier workflows, or custom Flask endpoints that process wine queries and return structured recommendations.

## Swedish compliance creates significant implementation constraints

**Swedish alcohol regulations heavily restrict marketing activities** under the Swedish Alcohol Act (2010:1622), requiring "distinct and moderate" advertising without consumption encouragement. Applications must implement **age verification for 20+ users**, include health disclaimers, and avoid content that could increase alcohol consumption.

**GDPR compliance adds data protection requirements** including EU data residency preferences, comprehensive consent management, and audit logging capabilities. Swedish hosting providers like HostUp.se or international platforms with Stockholm regions provide appropriate infrastructure.

**Terms of service violations led to API discontinuation**, making compliance interpretation critical for any unofficial API usage. Applications cannot appear as Systembolaget endorsements, must align with their mission as independent operators, and cannot engage in commercial alcohol sales promotion.

## Practical implementation pathways balance risk and functionality

**Conservative approach using official APIs** limits functionality to store locations and educational content without specific product recommendations. This ensures full compliance but provides limited AI wine assistance capabilities.

**Unofficial API integration** offers comprehensive product data through community projects like AlexGustafsson's solution, enabling full wine recommendation functionality but carrying legal uncertainty. Implementation requires fallback systems, legal monitoring, and kill switch capabilities.

**Hybrid solutions combine multiple data sources** including official store APIs, third-party wine databases, and educational content to provide comprehensive wine assistance while minimizing legal risks. This approach balances functionality with compliance through diverse data sourcing.

## Conclusion

Building AI wine tools for Systembolaget requires navigating discontinued official APIs, utilizing community workarounds with legal uncertainty, and maintaining strict compliance with Swedish regulations. **MCP integration offers the most promising technical pathway** for Claude Desktop users, while Discord bots provide excellent alternative user interfaces. Success depends on conservative compliance approaches, multiple fallback strategies, and continuous monitoring of the evolving legal landscape surrounding unofficial API usage.